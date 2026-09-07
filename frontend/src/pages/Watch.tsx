import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Plus, Film } from 'lucide-react';
import { GET_WATCH_FEED } from '@/lib/graphql';
import { AppLayout } from './Home';
import { VideoCard } from '@/components/Watch/VideoCard';
import { CreateVideoModal } from '@/components/Watch/CreateVideoModal';

// Must match CreateVideoModal's WATCH_FEED_LIMIT — its cache.writeQuery
// prepend keys on this exact `limit` variable.
const FEED_LIMIT = 6;

export function WatchPage() {
  const { data, loading, fetchMore } = useQuery(GET_WATCH_FEED, {
    variables: { limit: FEED_LIMIT },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const loadingMoreRef = useRef(false);

  const videos: any[] = (data?.watchFeed?.videos ?? []).filter((v: any) => v && !deletedIds.has(v.id));
  const hasMore = data?.watchFeed?.hasMore;
  const nextCursor = data?.watchFeed?.nextCursor;

  // Default to the first video being "active" (playing) as soon as the
  // feed loads, rather than waiting for the user to scroll before anything
  // autoplays.
  useEffect(() => {
    if (!activeId && videos.length > 0) setActiveId(videos[0].id);
  }, [videos, activeId]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const id = (entry.target as HTMLElement).dataset.videoId;
            if (id) setActiveId(id);
          }
        });
      },
      { root, threshold: [0.6] }
    );
    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos.length]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      await fetchMore({ variables: { cursor: nextCursor, limit: FEED_LIMIT } });
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMore, loading, nextCursor, fetchMore]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 800) handleLoadMore();
  }, [handleLoadMore]);

  const handleDeleted = useCallback((id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
  }, []);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Film size={22} className="text-brand-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Watch</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Upload
        </button>
      </div>

      {loading && videos.length === 0 && (
        <div className="h-[calc(100vh-11rem)] rounded-2xl bg-gray-200 dark:bg-surface-dark-3 animate-pulse" />
      )}

      {!loading && videos.length === 0 && (
        <div className="h-[calc(100vh-11rem)] flex flex-col items-center justify-center text-center rounded-2xl bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-gray-700">
          <Film size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No videos yet</p>
          <p className="text-sm text-gray-400 mt-1">Be the first to share a reel.</p>
        </div>
      )}

      {videos.length > 0 && (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-[calc(100vh-11rem)] overflow-y-scroll snap-y snap-mandatory rounded-2xl scrollbar-hide"
        >
          {videos.map((v) => (
            <div
              key={v.id}
              data-video-id={v.id}
              ref={(el) => {
                if (el) cardRefs.current.set(v.id, el);
                else cardRefs.current.delete(v.id);
              }}
              className="h-full snap-start snap-always"
            >
              <VideoCard video={v} isActive={activeId === v.id} onDeleted={handleDeleted} />
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateVideoModal onClose={() => setShowCreate(false)} />}
    </AppLayout>
  );
}
