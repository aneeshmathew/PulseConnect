import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { makeExecutableSchema } from '@graphql-tools/schema';
import connectDB from './config/database';
import { typeDefs } from './graphql/typedefs';
import { resolvers } from './graphql/resolvers';
import { createContext, createWsContext } from './graphql/context';
import { uploadRouter } from './routes/upload';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Validate required env vars up front — fail fast, fail clear
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

async function bootstrap() {
  await connectDB();

  const app = express();
  const httpServer = http.createServer(app);
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // ── WebSocket server (subscriptions) ──────────────────────────────────────
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

  const serverCleanup = useServer(
    {
      schema,
      context: createWsContext,
      onConnect: async (ctx: any) => {
        if (isDev) console.log('🔌 WS connected');
        return true;
      },
      onDisconnect: () => {
        if (isDev) console.log('🔌 WS disconnected');
      },
      onError: (ctx: any, msg: any, errors: any) => {
        console.error('[WS subscription error]', errors);
      },
    },
    wsServer
  );

  // ── Apollo Server ─────────────────────────────────────────────────────────
  const apolloServer = new ApolloServer({
    schema,
    introspection: isDev, // disable introspection in production
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      !isDev ? ApolloServerPluginLandingPageDisabled() : {},
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (formattedError, error) => {
      // Always log server-side, regardless of environment — see the
      // matching comment in api/_app.ts for why this matters (previously
      // silent in production).
      //
      // ✅ Refinement: this used to log every error identically with a full
      // stack trace — including an expected, everyday client error (an
      // expired/invalid token correctly getting rejected by requireAuth).
      // That's the feature working, not a bug, so it only needs a one-line
      // note; the full original message + stack is reserved for anything
      // outside that expected-client-error set.
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

      // Don't leak internal error details in production
      if (!isDev && !expectedClientErrors.includes(code as string)) {
        return { message: 'Internal server error', extensions: { code: 'INTERNAL_SERVER_ERROR' } };
      }
      return formattedError;
    },
  });

  await apolloServer.start();

  // ── Express middleware ─────────────────────────────────────────────────────
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map(s => s.trim());

  const isOriginAllowed = (origin?: string | null): boolean =>
    !origin || (isDev && origin.startsWith('http://localhost:')) || allowedOrigins.includes(origin);

  app.use(cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }));

  // Tighter body size limits — 50mb was far too permissive
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, { context: createContext })
  );

  // ── Media upload signature endpoint (Cloudinary direct-to-cloud upload,
  //    see routes/upload.ts — no files ever touch this server) ──────────────
  app.use('/api', uploadRouter);

  // ── Health & readiness probes ─────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
  });

  // ── Global error handler (catches unhandled sync Express errors) ──────────
  // See the matching comment in api/_app.ts — without re-applying the CORS
  // decision here, error responses (including cors()'s own origin
  // rejections) go out with no Access-Control-Allow-Origin header, and the
  // browser reports it as a CORS failure regardless of what actually failed.
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

  // ── Unhandled rejection safety net ───────────────────────────────────────
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', reason);
    // Don't exit — log and continue
  });

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 GraphQL ready   → http://localhost:${PORT}/graphql`);
    console.log(`🔌 Subscriptions   → ws://localhost:${PORT}/graphql`);
    console.log(`💚 Health check    → http://localhost:${PORT}/health`);
    console.log(`🌍 Environment     → ${process.env.NODE_ENV ?? 'development'}\n`);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
