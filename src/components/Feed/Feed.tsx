import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { GET_FEED, NEW_POST_SUB } from '@/lib/graphql';
import { subscriptionsEnabled, POLL_INTERVAL_MS } from '@/lib/apollo';
import { PostCard } from '@/components/Post/PostCard';
import { CreatePost } from '@/components/Post/CreatePost';
import { StoriesBar } from '@/components/Stories/StoriesBar';
import { PostSkeleton } from '@/components/UI/Skeleton';
import { useAuthStore } from '@/store';
import toast from 'react-hot-toast';

// Load 15 per page — gives virtual scroll enough items to demonstrate
const LIMIT = 15;

export function Feed() {
  const { isAuthenticated } = useAuthStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const loadingMore = useRef(false);

  const { data, loading, fetchMore, refetch, networkStatus } = useQuery(GET_FEED, {
    variables: { limit: LIMIT },
    skip: !isAuthenticated,
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-and-network',
  });

  // New-post subscription — banner instead of auto-insert to avoid layout jumps.
  // Only live where a WebSocket-capable backend is configured (see apollo.ts).
  useSubscription(NEW_POST_SUB, {
    skip: !isAuthenticated || !subscriptionsEnabled,
    onData: () => setHasNewPosts(true),
  });

  // See the matching comment in Profile.tsx — filters out cache entries
  // evicted by a delete that happened elsewhere (e.g. the Photos tab)
  // without this list being re-fetched.
  const posts: any[] = (data?.feed?.posts ?? []).filter(Boolean);
  const latestPostId: string | undefined = posts[0]?.id;

  // Polling fallback for deployments without subscriptions (e.g. Vercel):
  // periodically peek at the newest post and flip the same "new posts"
  // banner the subscription would have triggered. fetchPolicy 'no-cache'
  // is important here — the `feed` field is cached with keyArgs: false
  // (all pages share one cache entry), so a cached peek would silently
  // merge into and reorder the real feed data the virtualizer is using.
  const { data: peekData } = useQuery(GET_FEED, {
    variables: { limit: 1 },
    skip: !isAuthenticated || subscriptionsEnabled,
    pollInterval: subscriptionsEnabled ? 0 : POLL_INTERVAL_MS.feedNewPostsCheck,
    fetchPolicy: 'no-cache',
    notifyOnNetworkStatusChange: false,
  });

  useEffect(() => {
    if (subscriptionsEnabled || !latestPostId) return;
    const newestPolledId = peekData?.feed?.posts?.[0]?.id;
    if (newestPolledId && newestPolledId !== latestPostId) {
      setHasNewPosts(true);
    }
  }, [peekData, latestPostId]);
  const hasMore: boolean = data?.feed?.hasMore ?? false;
  const nextCursor: string | null = data?.feed?.nextCursor ?? null;
  // Show skeletons on first load (no posts yet), not on subsequent fetches
  const isInitialLoad = loading && posts.length === 0;

  const handleRefresh = useCallback(async () => {
    setHasNewPosts(false);
    await refetch({ cursor: undefined, limit: LIMIT });
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [refetch]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore.current || !nextCursor) return;
    loadingMore.current = true;
    try {
      await fetchMore({ variables: { cursor: nextCursor, limit: LIMIT } });
    } catch {
      toast.error('Failed to load more posts');
    } finally {
      loadingMore.current = false;
    }
  }, [hasMore, loading, nextCursor, fetchMore]);

  // Virtual items = real posts + trailing skeletons while loading more
  const skeletonCount = loading && posts.length > 0 ? 3 : isInitialLoad ? LIMIT : 0;
  const totalCount = posts.length + skeletonCount;

  const rowVirtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 460,      // good initial estimate; actual measured after mount
    overscan: 4,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 460,
  });

  // Infinite scroll trigger — load more when 3rd-to-last post is visible
  useEffect(() => {
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (!virtualItems.length || !posts.length) return;
    const lastVisible = virtualItems[virtualItems.length - 1];
    if (lastVisible.index >= posts.length - 3) {
      handleLoadMore();
    }
  // Stable dep: only re-run when the last visible index or post count changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rowVirtualizer.getVirtualItems().at(-1)?.index,
    posts.length,
    hasMore,
    loading,
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── Fixed header (Stories + Composer) ─────────────────────────── */}
      <div className="flex-shrink-0 space-y-3 pb-3">
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-4">
          <StoriesBar />
        </div>
        <CreatePost />
      </div>

      {/* ── New posts banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {hasNewPosts && (
          <motion.button
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onClick={handleRefresh}
            className="flex-shrink-0 flex items-center justify-center gap-2 py-2.5 mb-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
          >
            <RefreshCw size={15} />
            New posts — tap to refresh
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Virtualized feed ─────────────────────────────────────────── */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {/* Initial skeleton state */}
        {isInitialLoad && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Virtual list */}
        {!isInitialLoad && (
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const post = posts[virtualItem.index];
              const isSkeleton = !post; // trailing skeleton while loading more

              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    paddingBottom: '12px',
                  }}
                >
                  {isSkeleton ? <PostSkeleton /> : <PostCard post={post} />}
                </div>
              );
            })}
          </div>
        )}

        {/* End of feed */}
        {!hasMore && posts.length > 0 && !loading && (
          <div className="flex flex-col items-center py-10 gap-2 text-gray-400 dark:text-gray-500 select-none">
            <span className="text-2xl">🎉</span>
            <p className="text-sm font-medium">You're all caught up!</p>
            <p className="text-xs">You've seen all {posts.length} posts</p>
          </div>
        )}
      </div>
    </div>
  );
}
