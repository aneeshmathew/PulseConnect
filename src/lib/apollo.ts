import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  split,
  from,
  ApolloLink,
  type TypePolicies,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

// Vite loads .env / .env.local in EVERY mode, including `npm run dev`.
// VITE_GRAPHQL_URL is honored whenever it's explicitly set — including in
// dev, so you can point a local `npm run dev` at a deployed backend (e.g.
// Vercel) without running one locally. Leave it unset and dev falls back
// to localhost:4000 as before. Just make sure the backend you're pointing
// at allows your dev origin (http://localhost:5173) in CORS, or requests
// will fail with a CORS error instead of connecting.
const isDevServer = import.meta.env.DEV;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const explicitGraphqlUrl: string | undefined = import.meta.env.VITE_GRAPHQL_URL;
// True only when there's no explicit remote VITE_GRAPHQL_URL — i.e. this
// is a genuinely local setup (dev server or plain localhost), not dev
// pointed at a remote backend. Used below to keep subscriptions off by
// default against a remote (e.g. Vercel serverless) backend, which can't
// hold a WebSocket open anyway.
const isLocalBackendSetup = !explicitGraphqlUrl && (isDevServer || isLocalhost);

const defaultGraphqlUrl = explicitGraphqlUrl
  ?? (isDevServer || isLocalhost ? 'http://localhost:4000/graphql' : '/api/graphql');

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
// Only auto-enabled for a genuinely local setup (dev server / localhost
// with no explicit remote VITE_GRAPHQL_URL) — pointing dev at a deployed
// backend no longer force-enables subscriptions against it. Set
// VITE_ENABLE_SUBSCRIPTIONS=true and VITE_WS_URL if you deploy the
// WebSocket server elsewhere (see DEPLOYMENT.md).
export const subscriptionsEnabled = import.meta.env.VITE_ENABLE_SUBSCRIPTIONS === 'true' || isLocalBackendSetup;

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
const explicitWsUrl: string | undefined = import.meta.env.VITE_WS_URL;
const defaultWsUrl = explicitWsUrl
  ?? (isDevServer || isLocalhost ? 'ws://localhost:4000/graphql' : `${wsProtocol}://${window.location.host}/graphql`);
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

// Exported separately (not just inlined into `apolloCache` below) so tests
// that need to exercise real pagination behavior — e.g. a "Load more"
// integration test for watchFeed/upcomingEvents/marketplaceListings —
// can build their own fresh `InMemoryCache` with these same policies
// instead of either reusing this singleton (which would leak state
// between tests) or falling back to MockedProvider's bare default cache
// (which has no merge/keyArgs config at all, so fetchMore results land
// under an entirely different, unwatched cache key and the "Load more"
// UI never updates — see docs/DEVELOPMENT.md changelog for the test
// failure this caused before this export existed).
export const cacheTypePolicies: TypePolicies = {
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
};

export const apolloCache = new InMemoryCache({ typePolicies: cacheTypePolicies });

export const client = new ApolloClient({
  link: activeLink,
  cache: apolloCache,
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
  },
  connectToDevTools: import.meta.env.DEV,
});
