import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InMemoryCache } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing';
import { Feed } from '@/components/Feed/Feed';
import { GET_FEED, NEW_POST_SUB } from '@/lib/graphql';

// Feed's own job is: initial-loading skeletons, the (virtualized) post list
// plus "end of feed" state, infinite-scroll fetchMore, and the new-post
// subscription banner. PostCard/StoriesBar/CreatePost each have their own
// query/mutation needs unrelated to any of that, so they're stubbed out to
// keep this file focused on Feed's container logic.
vi.mock('@/store', () => ({
  useAuthStore: () => ({ isAuthenticated: true }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/Post/PostCard', () => ({
  PostCard: ({ post }: any) => <div data-testid={`post-${post.id}`}>{post.content}</div>,
}));
vi.mock('@/components/Post/CreatePost', () => ({ CreatePost: () => <div data-testid="create-post" /> }));
vi.mock('@/components/Stories/StoriesBar', () => ({ StoriesBar: () => <div data-testid="stories-bar" /> }));

// react-virtual computes its visible range from real layout (scroll
// container height/scrollTop), which jsdom never provides — stub it to
// simply render every item so it's Feed's own logic under test, not the
// virtualizer library's.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 100 })),
    getTotalSize: () => count * 100,
    measureElement: () => {},
  }),
}));

// `let` (not `const`) so each test can flip it — safe from the usual
// vi.mock hoisting TDZ trap because the getter body only runs lazily, the
// first time Feed actually reads `subscriptionsEnabled`, by which point
// this variable is long since initialized.
let subscriptionsEnabled = false;
vi.mock('@/lib/apollo', () => ({
  get subscriptionsEnabled() { return subscriptionsEnabled; },
  POLL_INTERVAL_MS: { feedNewPostsCheck: 999999 },
}));

function makePost(id: string, content: string) {
  return {
    __typename: 'Post',
    id,
    content,
    media: [],
    reactionSummary: [],
    myReaction: null,
    isSaved: false,
    commentsCount: 0,
    sharesCount: 0,
    visibility: 'PUBLIC',
    location: null,
    feeling: null,
    isPinned: false,
    isEdited: false,
    viewCount: 0,
    createdAt: new Date().toISOString(),
    author: {
      __typename: 'User', id: 'author1', username: 'author', firstName: 'Author', lastName: 'One',
      fullName: 'Author One', avatar: null, isOnline: false, isVerified: false, isFriend: false, friendsCount: 0,
    },
  };
}

// Mirrors the real `feed` field's merge policy in src/lib/apollo.ts so
// fetchMore pagination behaves the same way it does in the app.
function makeCache() {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          feed: {
            keyArgs: false,
            merge(existing: any, incoming: any) {
              if (!existing) return incoming;
              const existingSet = new Set((existing.posts ?? []).map((p: any) => p.__ref));
              const merged = [...(existing.posts ?? [])];
              (incoming.posts ?? []).forEach((p: any) => {
                if (!existingSet.has(p.__ref)) merged.push(p);
              });
              return { ...incoming, posts: merged };
            },
          },
        },
      },
      Post: { keyFields: ['id'] },
      User: { keyFields: ['id'] },
    },
  });
}

function renderFeed(mocks: any[]) {
  return render(
    <MockedProvider mocks={mocks} cache={makeCache()}>
      <Feed />
    </MockedProvider>
  );
}

beforeAll(() => {
  // jsdom doesn't implement scrollTo; Feed calls it after a manual refresh.
  Element.prototype.scrollTo = vi.fn() as any;
});

beforeEach(() => {
  subscriptionsEnabled = false;
});

describe('Feed', () => {
  it('shows skeleton placeholders before the first page of posts loads', () => {
    const mocks = [
      { request: { query: GET_FEED, variables: { limit: 15 } }, result: { data: { feed: { posts: [], hasMore: false, nextCursor: null, total: 0 } } } },
      { request: { query: GET_FEED, variables: { limit: 1 } }, result: { data: { feed: { posts: [], hasMore: false, nextCursor: null, total: 0 } } } },
    ];
    renderFeed(mocks);
    // The initial-load skeleton is a fixed block of 5, independent of LIMIT
    // — it renders before the virtualizer (which needs real post data) ever
    // gets involved.
    expect(screen.getAllByLabelText('Loading post')).toHaveLength(5);
  });

  it('renders posts once loaded and shows the end-of-feed message when there is no more to load', async () => {
    const posts = [makePost('p1', 'First post'), makePost('p2', 'Second post')];
    const mocks = [
      { request: { query: GET_FEED, variables: { limit: 15 } }, result: { data: { feed: { posts, hasMore: false, nextCursor: null, total: 2 } } } },
      { request: { query: GET_FEED, variables: { limit: 1 } }, result: { data: { feed: { posts: [posts[0]], hasMore: false, nextCursor: null, total: 2 } } } },
    ];
    renderFeed(mocks);

    expect(await screen.findByText('First post')).toBeInTheDocument();
    expect(screen.getByText('Second post')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
  });

  it('loads the next page via infinite scroll and appends it to the list', async () => {
    const page1 = [makePost('p1', 'First post')];
    const page2 = [makePost('p2', 'Second post')];
    const mainPageResult = { result: { data: { feed: { posts: page1, hasMore: true, nextCursor: 'CURSOR1', total: 2 } } } };
    const fetchMoreResult = { result: { data: { feed: { posts: page2, hasMore: false, nextCursor: null, total: 2 } } } };
    const mocks = [
      // `feed` is cached with keyArgs: false (see makeCache above), so
      // fetchMore's write into that shared slot can cause the main
      // cache-and-network query to re-issue its own fetch once more —
      // provide two of each so that either way, nothing runs out.
      { request: { query: GET_FEED, variables: { limit: 15 } }, ...mainPageResult },
      { request: { query: GET_FEED, variables: { limit: 15 } }, ...mainPageResult },
      { request: { query: GET_FEED, variables: { limit: 1 } }, result: { data: { feed: { posts: page1, hasMore: true, nextCursor: 'CURSOR1', total: 2 } } } },
      { request: { query: GET_FEED, variables: { cursor: 'CURSOR1', limit: 15 } }, ...fetchMoreResult },
      { request: { query: GET_FEED, variables: { cursor: 'CURSOR1', limit: 15 } }, ...fetchMoreResult },
    ];
    renderFeed(mocks);

    expect(await screen.findByText('First post')).toBeInTheDocument();
    // The stubbed virtualizer renders every item, so Feed's own
    // "3rd-from-last visible" infinite-scroll effect fires as soon as the
    // first page renders, automatically requesting the next page.
    expect(await screen.findByText('Second post')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
  });

  it('shows a "new posts" banner when a post arrives over the live subscription, and clears it on refresh', async () => {
    subscriptionsEnabled = true;
    const initialPosts = [makePost('p1', 'First post')];
    const refreshedPosts = [makePost('p2', 'Brand new post'), ...initialPosts];
    const mocks = [
      { request: { query: GET_FEED, variables: { limit: 15 } }, result: { data: { feed: { posts: initialPosts, hasMore: false, nextCursor: null, total: 1 } } } },
      { request: { query: NEW_POST_SUB }, result: { data: { newPost: makePost('p2', 'Brand new post') } } },
      { request: { query: GET_FEED, variables: { cursor: undefined, limit: 15 } }, result: { data: { feed: { posts: refreshedPosts, hasMore: false, nextCursor: null, total: 2 } } } },
    ];
    renderFeed(mocks);

    expect(await screen.findByText('First post')).toBeInTheDocument();
    const banner = await screen.findByText(/new posts — tap to refresh/i);
    expect(banner).toBeInTheDocument();

    fireEvent.click(banner);
    // The banner is wrapped in AnimatePresence with an exit animation, so
    // it doesn't leave the DOM the instant hasNewPosts flips to false —
    // wait for the exit transition to finish instead of asserting
    // synchronously.
    await waitFor(() => {
      expect(screen.queryByText(/new posts — tap to refresh/i)).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Brand new post')).toBeInTheDocument();
  });
});
