import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  split,
  from,
  ApolloLink,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// Vite loads .env / .env.local in EVERY mode, including `npm run dev` — so
// if VITE_GRAPHQL_URL is set anywhere for production, it would previously
// also leak into local dev and point your dev server at the deployed
// backend (which CORS-blocks it, since only the deployed frontend origin
// is allowlisted there). `import.meta.env.DEV` is only true while running
// the Vite dev server, so gating on it makes `npm run dev` immune to
// whatever is in VITE_GRAPHQL_URL / VITE_WS_URL — it always talks to your
// local backend. Vercel's build runs `vite build` (DEV=false), so the
// deployed frontend still picks up VITE_GRAPHQL_URL as intended.
const isDevServer = import.meta.env.DEV;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const defaultGraphqlUrl = isDevServer
  ? 'http://localhost:4000/graphql'
  : (import.meta.env.VITE_GRAPHQL_URL ?? (isLocalhost ? 'http://localhost:4000/graphql' : '/api/graphql'));

const httpLink = createHttpLink({
  uri: defaultGraphqlUrl,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// Exported (not just used internally by `httpChain` below) so it can be
// unit-tested in isolation — see frontend/tests/lib/apollo.test.ts.
export const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Only redirect once — avoid loops on the login page
        if (!window.location.pathname.startsWith('/login')) {
          // ✅ Fix: removing only 'token' left the Zustand-persisted
          // 'auth-storage' entry (isAuthenticated: true + the stale user
          // object) in place. On the reload below, that store rehydrates as
          // still-logged-in, PublicRoute immediately bounces /login back to
          // "/", the now-tokenless queries fail UNAUTHENTICATED again, and
          // it silently loops back and forth — never actually reaching the
          // login form. Clearing both keys mirrors what the manual "Log Out"
          // button does (useAuthStore's logout()), which is the only path
          // that previously worked.
          localStorage.removeItem('token');
          localStorage.removeItem('auth-storage');
          window.location.replace('/login');
        }
        return;
      }
      if (import.meta.env.DEV) {
        console.error(`[GraphQL error] op=${operation.operationName}: ${message}`);
      }
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
   const statusCode = (networkError as any)?.statusCode;
    const isConnectionFailure = !statusCode || [502, 503, 504].includes(statusCode);
    if (isConnectionFailure && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('auth-storage');
      window.location.replace('/login');
    }
  }
});

// Vercel Node.js serverless functions can't hold a persistent WebSocket
// connection open, so a backend deployed to Vercel (see backend/api/) can
// only serve GraphQL over HTTP — subscriptions won't work against it.
// Default to disabled in any build without an explicit VITE_WS_URL / on
// localhost; set VITE_ENABLE_SUBSCRIPTIONS=true and VITE_WS_URL if you
// deploy the WebSocket server elsewhere (see DEPLOYMENT.md).
export const subscriptionsEnabled = import.meta.env.VITE_ENABLE_SUBSCRIPTIONS === 'true' || isDevServer || isLocalhost;

// Fallback polling cadence used by Feed/Chat when subscriptionsEnabled is
// false — a cheap stand-in for push updates that costs nothing beyond
// normal HTTP requests (no WebSocket host required). Chat polls fastest
// since messages are the most time-sensitive; the feed "new posts" check
// and conversation list (unread badges) can be a bit more relaxed.
export const POLL_INTERVAL_MS = {
  chatMessages: 3000,
  conversationsList: 8000,
  feedNewPostsCheck: 12000,
} as const;

// Detect HTTPS → use wss://, HTTP → ws://
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const defaultWsUrl = isDevServer
  ? 'ws://localhost:4000/graphql'
  : (import.meta.env.VITE_WS_URL ?? (isLocalhost ? 'ws://localhost:4000/graphql' : `${wsProtocol}://${window.location.host}/graphql`));
const wsUrl = defaultWsUrl;

const httpChain = from([errorLink, authLink, httpLink]);

const activeLink: ApolloLink = subscriptionsEnabled
  ? split(
      ({ query }) => {
        const def = getMainDefinition(query);
        return def.kind === 'OperationDefinition' && def.operation === 'subscription';
      },
      new GraphQLWsLink(
        createClient({
          url: wsUrl,
          connectionParams: () => {
            const token = localStorage.getItem('token');
            return token ? { authorization: `Bearer ${token}` } : {};
          },
          retryAttempts: 10,
          shouldRetry: () => true,
          on: {
            error: (err) => console.warn('[WS error]', err),
          },
        })
      ),
      httpChain
    )
  : httpChain;

// Shared merge policy for cursor-paginated connection-shaped fields
// (`{ <listKey>: [...], hasMore, nextCursor }`) that fetchMore() calls
// with `{ cursor, limit }` variables (plus, optionally, one or more real
// filter arguments that SHOULD scope the cache key — e.g. marketplace's
// `category` — passed via `keyArgs`, same idea as `messages`'
// `keyArgs: ['conversationId']` below). `cursor`/`limit` are always
// excluded either way since fetchMore()'s whole point is to vary them
// without starting a new list. The merge dedupes by `__ref` before
// appending — this is the exact same shape/reasoning as the `feed` field
// policy just below, applied generically since `watchFeed`,
// `upcomingEvents`, and `marketplaceListings` all need the identical fix
// (see docs/DEVELOPMENT.md changelog): without a merge function, Apollo's
// default field policy replaces the cached value on every fetchMore()
// rather than appending, which silently turned "Load more" into "replace
// the list".
function paginatedConnectionMerge(listKey: string, keyArgs: string[] | false = false) {
  return {
    keyArgs,
    merge(existing: any, incoming: any) {
      if (!existing) return incoming;
      const existingSet = new Set((existing[listKey] ?? []).map((item: any) => item.__ref));
      const merged = [...(existing[listKey] ?? [])];
      (incoming[listKey] ?? []).forEach((item: any) => {
        if (!existingSet.has(item.__ref)) merged.push(item);
      });
      return { ...incoming, [listKey]: merged };
    },
  };
}

export const apolloCache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        feed: {
          keyArgs: false,
          merge(existing: any, incoming: any) {
            if (!existing) return incoming;
            // Deduplicate by __ref
            const existingSet = new Set((existing.posts ?? []).map((p: any) => p.__ref));
            const merged = [...(existing.posts ?? [])];
            (incoming.posts ?? []).forEach((p: any) => {
              if (!existingSet.has(p.__ref)) merged.push(p);
            });
            return { ...incoming, posts: merged };
          },
        },
        watchFeed: paginatedConnectionMerge('videos'),
        upcomingEvents: paginatedConnectionMerge('events'),
        marketplaceListings: paginatedConnectionMerge('listings', ['category']),
        messages: {
          keyArgs: ['conversationId'],
          merge(existing: any[] = [], incoming: any[]) {
            const existingSet = new Set(existing.map((m: any) => m.__ref));
            const merged = [...existing];
            incoming.forEach((m: any) => {
              if (!existingSet.has(m.__ref)) merged.push(m);
            });
            return merged;
          },
        },
      },
    },
    Post: { keyFields: ['id'] },
    User: { keyFields: ['id'] },
    Message: { keyFields: ['id'] },
    Conversation: { keyFields: ['id'] },
    Notification: { keyFields: ['id'] },
    Story: { keyFields: ['id'] },
    Comment: { keyFields: ['id'] },
  },
});

export const client = new ApolloClient({
  link: activeLink,
  cache: apolloCache,
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
  },
  connectToDevTools: import.meta.env.DEV,
});
