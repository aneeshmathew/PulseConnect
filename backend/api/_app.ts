import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { makeExecutableSchema } from '@graphql-tools/schema';
import connectDB from '../src/config/database';
import { typeDefs } from '../src/graphql/typedefs';
import { resolvers } from '../src/graphql/resolvers';
import { createContext } from '../src/graphql/context';
import { uploadRouter } from '../src/routes/upload';

const isDev = process.env.NODE_ENV !== 'production';

// Fail loud (but don't crash the whole lambda module on import) if required
// env vars are missing — the health check / first request will surface this.
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
  }
}

/**
 * NOTE ON WEBSOCKET SUBSCRIPTIONS
 * ────────────────────────────────
 * Vercel Node.js serverless functions are request/response only — they
 * cannot hold a persistent WebSocket connection open the way the local
 * dev server (src/index.ts) does with `graphql-ws` + `ws`. This handler
 * therefore only serves GraphQL over HTTP (queries + mutations).
 *
 * Real-time subscriptions will not work against this deployment. See
 * DEPLOYMENT.md for options if you need them in production.
 */

let appPromise: Promise<Express> | null = null;

async function buildApp(): Promise<Express> {
  await connectDB();

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const apolloServer = new ApolloServer({
    schema,
    introspection: isDev,
    plugins: [
      ...(!isDev ? [ApolloServerPluginLandingPageDisabled()] : []),
    ],
    formatError: (formattedError, error) => {
      // Always log server-side, regardless of environment. Previously this
      // only logged in dev — meaning in production, an unexpected resolver
      // exception was masked to "Internal server error" for the client AND
      // never logged anywhere at all, making it look like the request just
      // silently misbehaved with zero trace to debug from. This is why a
      // real backend exception could go unnoticed through several rounds
      // of testing: nothing in Vercel's logs ever pointed at it.
      //
      // ✅ Refinement: that fix logged EVERY error identically, full stack
      // trace included — which meant an expected, everyday client error
      // (someone's token expired, so `requireAuth` correctly rejects them)
      // dumped the exact same alarming wall of text as a genuine unhandled
      // exception. There's nothing to fix when a logged-out user's request
      // gets told "not authenticated" — that's the feature working — so it
      // only needs a one-line note, not a stack trace. Anything outside
      // that expected-client-error set still gets the full original
      // message + stack, unchanged from before.
      const code = formattedError.extensions?.code as string | undefined;
      const expectedClientErrors = ['UNAUTHENTICATED', 'FORBIDDEN', 'BAD_USER_INPUT', 'NOT_FOUND'];
      const original = (error as any)?.originalError ?? error;

      if (expectedClientErrors.includes(code as string)) {
        console.log(`[GraphQL] ${code} on ${formattedError.path?.join('.')}: ${formattedError.message}`);
      } else {
        console.error('[GraphQL Error]', {
          message: original?.message ?? formattedError.message,
          path: formattedError.path,
          code,
          stack: original?.stack,
        });
      }

      if (!isDev && !expectedClientErrors.includes(code as string)) {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }
      return formattedError;
    },
  });

  await apolloServer.start();

  const app = express();

  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());

  const isOriginAllowed = (origin?: string | null): boolean =>
    !origin || (isDev && origin.startsWith('http://localhost:')) || allowedOrigins.includes(origin);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  app.use(
    ['/api/graphql', '/graphql'],
    expressMiddleware(apolloServer, { context: createContext })
  );

  // Media upload signature endpoint — safe on serverless since no file
  // bytes are ever written to this server's disk (see src/routes/upload.ts).
  app.use('/api', uploadRouter);

  // Global error handler.
  //
  // IMPORTANT: when cors()'s origin callback above rejects a request (or
  // any other error happens on an already-CORS-approved request), Express
  // routes it straight here — *skipping* the cors() middleware's normal
  // header-setting logic. Without re-adding the header here, EVERY error
  // response (not just origin rejections) goes out with no
  // Access-Control-Allow-Origin header, and the browser reports it as a
  // CORS failure — hiding whatever the real error was. This previously
  // caused confusing "blocked by CORS policy" errors for failures that had
  // nothing to do with CORS. Re-apply the same allow/deny decision here so:
  //   - a legitimately-allowed origin still sees the real error (500 body,
  //     visible in the network tab) instead of a misleading CORS block.
  //   - a genuinely disallowed origin still gets blocked (no header set),
  //     but the server log below makes it obvious *why*, instead of
  //     someone chasing a phantom "CORS misconfigured" bug when the origin
  //     really is just wrong.
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('[Express error]', err.message);
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
      if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      console.error(`[CORS] Rejected origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    }
    res.status(500).json({ error: isDev ? err.message : 'Internal server error' });
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', reason);
  });

  return app;
}

/**
 * Returns a singleton, fully-initialized Express app. On a warm Vercel
 * lambda instance this resolves instantly (DB connection, schema, and
 * Apollo Server are all reused between invocations).
 */
export function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = buildApp().catch((err) => {
      // Reset so the next invocation gets a fresh attempt instead of a
      // permanently-rejected cached promise.
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}
