import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApolloLink, Observable, execute, gql } from '@apollo/client';

// graphql-ws's browser client throws synchronously at construction if no
// WebSocket implementation is available anywhere — jsdom doesn't provide a
// global WebSocket, and apollo.ts constructs its GraphQLWsLink at module
// load time (not lazily). A minimal stub is enough to satisfy the
// existence check: nothing in these tests ever actually opens a
// connection (graphql-ws only connects on the first real subscription,
// which we never trigger here).
class FakeWebSocket {}
(globalThis as any).WebSocket = (globalThis as any).WebSocket ?? FakeWebSocket;

const TEST_QUERY = gql`
  query Test {
    test
  }
`;

let originalLocation: Location;

beforeEach(() => {
  localStorage.clear();
  originalLocation = window.location;
  // jsdom's window.location isn't directly reassignable in place — delete
  // and replace it with a plain object carrying the bits errorLink reads
  // (`pathname`) and the one it calls (`replace`), spread over the
  // original so anything else (hostname, protocol) stays realistic.
  // @ts-expect-error -- intentionally replacing a normally-immutable global for this test
  delete window.location;
  window.location = { ...originalLocation, pathname: '/feed', replace: vi.fn() } as unknown as Location;
});

afterEach(() => {
  window.location = originalLocation;
});

function terminatingLink(behavior: (observer: any) => void) {
  return new ApolloLink(() => new Observable((observer) => behavior(observer)));
}

// Regression + behavior coverage for the exact fix documented in
// apollo.ts's errorLink comment: an earlier version cleared only the
// `token` localStorage key on an auth failure, leaving the
// zustand-persisted `auth-storage` entry (isAuthenticated: true) in place
// — which caused a redirect-back-to-login loop. These tests assert both
// keys are cleared together, and that the "already on /login" guard and
// the connection-failure-vs-ordinary-HTTP-error distinction both still
// hold.
describe('errorLink', () => {
  it('clears both auth storage keys and redirects to /login on an UNAUTHENTICATED error', async () => {
    const { errorLink } = await import('@/lib/apollo');
    localStorage.setItem('token', 'abc123');
    localStorage.setItem('auth-storage', '{"state":{"isAuthenticated":true}}');

    const link = ApolloLink.from([
      errorLink,
      terminatingLink((observer) => {
        observer.next({
          errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } }] as any,
        });
        observer.complete();
      }),
    ]);

    await new Promise<void>((resolve) => {
      execute(link, { query: TEST_QUERY, operationName: 'Test' }).subscribe({ complete: resolve });
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('auth-storage')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/login');
  });

  it('does not redirect (or touch storage) when already on the login page', async () => {
    window.location.pathname = '/login';
    const { errorLink } = await import('@/lib/apollo');
    localStorage.setItem('token', 'abc123');

    const link = ApolloLink.from([
      errorLink,
      terminatingLink((observer) => {
        observer.next({
          errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } }] as any,
        });
        observer.complete();
      }),
    ]);

    await new Promise<void>((resolve) => {
      execute(link, { query: TEST_QUERY, operationName: 'Test' }).subscribe({ complete: resolve });
    });

    expect(window.location.replace).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBe('abc123');
  });

  it('does not log out on a non-auth graphQL error (e.g. validation)', async () => {
    const { errorLink } = await import('@/lib/apollo');
    localStorage.setItem('token', 'abc123');

    const link = ApolloLink.from([
      errorLink,
      terminatingLink((observer) => {
        observer.next({
          errors: [{ message: 'Content is required', extensions: { code: 'BAD_USER_INPUT' } }] as any,
        });
        observer.complete();
      }),
    ]);

    await new Promise<void>((resolve) => {
      execute(link, { query: TEST_QUERY, operationName: 'Test' }).subscribe({ complete: resolve });
    });

    expect(window.location.replace).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBe('abc123');
  });

  it('logs out on a connection-failure network error (no status code)', async () => {
    const { errorLink } = await import('@/lib/apollo');
    localStorage.setItem('token', 'abc123');

    const link = ApolloLink.from([
      errorLink,
      terminatingLink((observer) => observer.error(new Error('Failed to fetch'))),
    ]);

    await new Promise<void>((resolve) => {
      execute(link, { query: TEST_QUERY, operationName: 'Test' }).subscribe({ error: () => resolve() });
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/login');
  });

  it('does NOT log out on an ordinary HTTP error (e.g. 400) that is not a connection failure', async () => {
    const { errorLink } = await import('@/lib/apollo');
    localStorage.setItem('token', 'abc123');

    const link = ApolloLink.from([
      errorLink,
      terminatingLink((observer) => {
        const err: any = new Error('Bad request');
        err.statusCode = 400;
        observer.error(err);
      }),
    ]);

    await new Promise<void>((resolve) => {
      execute(link, { query: TEST_QUERY, operationName: 'Test' }).subscribe({ error: () => resolve() });
    });

    expect(localStorage.getItem('token')).toBe('abc123');
    expect(window.location.replace).not.toHaveBeenCalled();
  });

  it('DOES log out on a 503 (treated the same as a connection failure)', async () => {
    const { errorLink } = await import('@/lib/apollo');
    localStorage.setItem('token', 'abc123');

    const link = ApolloLink.from([
      errorLink,
      terminatingLink((observer) => {
        const err: any = new Error('Service unavailable');
        err.statusCode = 503;
        observer.error(err);
      }),
    ]);

    await new Promise<void>((resolve) => {
      execute(link, { query: TEST_QUERY, operationName: 'Test' }).subscribe({ error: () => resolve() });
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/login');
  });
});

describe('apolloCache — feed pagination merge', () => {
  const FEED_QUERY = gql`
    query Feed {
      feed {
        hasMore
        posts {
          id
        }
      }
    }
  `;

  it('appends new posts and de-duplicates by ref across pages, through the real cache API', async () => {
    const { apolloCache } = await import('@/lib/apollo');
    await apolloCache.reset();

    apolloCache.writeQuery({
      query: FEED_QUERY,
      data: {
        feed: {
          __typename: 'FeedConnection',
          hasMore: true,
          posts: [
            { __typename: 'Post', id: '1' },
            { __typename: 'Post', id: '2' },
          ],
        },
      },
    });

    // Post "2" appears again in the second page — must not be duplicated.
    apolloCache.writeQuery({
      query: FEED_QUERY,
      data: {
        feed: {
          __typename: 'FeedConnection',
          hasMore: false,
          posts: [
            { __typename: 'Post', id: '2' },
            { __typename: 'Post', id: '3' },
          ],
        },
      },
    });

    const result = apolloCache.readQuery({ query: FEED_QUERY });
    expect((result as any).feed.posts.map((p: any) => p.id)).toEqual(['1', '2', '3']);
    expect((result as any).feed.hasMore).toBe(false); // takes the incoming page's own fields as-is
  });
});

describe('apolloCache — messages merge', () => {
  const MESSAGES_QUERY = gql`
    query Messages($conversationId: ID!) {
      messages(conversationId: $conversationId) {
        id
      }
    }
  `;

  it('appends new messages and de-duplicates by ref, scoped per conversationId', async () => {
    const { apolloCache } = await import('@/lib/apollo');
    await apolloCache.reset();

    apolloCache.writeQuery({
      query: MESSAGES_QUERY,
      variables: { conversationId: 'conv1' },
      data: {
        messages: [
          { __typename: 'Message', id: 'm1' },
          { __typename: 'Message', id: 'm2' },
        ],
      },
    });
    apolloCache.writeQuery({
      query: MESSAGES_QUERY,
      variables: { conversationId: 'conv1' },
      data: {
        messages: [
          { __typename: 'Message', id: 'm2' },
          { __typename: 'Message', id: 'm3' },
        ],
      },
    });
    // A different conversation must not merge into conv1's list at all —
    // `keyArgs: ['conversationId']` is what makes that scoping possible.
    apolloCache.writeQuery({
      query: MESSAGES_QUERY,
      variables: { conversationId: 'conv2' },
      data: { messages: [{ __typename: 'Message', id: 'other-conv-message' }] },
    });

    const conv1 = apolloCache.readQuery({ query: MESSAGES_QUERY, variables: { conversationId: 'conv1' } });
    expect((conv1 as any).messages.map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3']);

    const conv2 = apolloCache.readQuery({ query: MESSAGES_QUERY, variables: { conversationId: 'conv2' } });
    expect((conv2 as any).messages.map((m: any) => m.id)).toEqual(['other-conv-message']);
  });
});
