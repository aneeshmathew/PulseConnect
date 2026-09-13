import { useState, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { Plus, Calendar } from 'lucide-react';
import { GET_UPCOMING_EVENTS } from '@/lib/graphql';
import { AppLayout } from './Home';
import { EventCard } from '@/components/Events/EventCard';
import { CreateEventModal } from '@/components/Events/CreateEventModal';

// Must match CreateEventModal's EVENTS_LIMIT — its cache.writeQuery
// prepend keys on this exact `limit` variable.
const EVENTS_LIMIT = 9;

export function EventsPage() {
  const { data, loading, fetchMore } = useQuery(GET_UPCOMING_EVENTS, {
    variables: { limit: EVENTS_LIMIT },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);

  const events: any[] = (data?.upcomingEvents?.events ?? []).filter((e: any) => e && !deletedIds.has(e.id));
  const hasMore = data?.upcomingEvents?.hasMore;
  const nextCursor = data?.upcomingEvents?.nextCursor;

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchMore({ variables: { cursor: nextCursor, limit: EVENTS_LIMIT } });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, nextCursor, fetchMore]);

  const handleDeleted = useCallback((id: string) => {
    setDeletedIds((prev) => new Set(prev).add(id));
  }, []);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={22} className="text-brand-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Events</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Create event
        </button>
      </div>

      {loading && events.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-200 dark:bg-surface-dark-3 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center rounded-2xl bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-gray-700">
          <Calendar size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No upcoming events</p>
          <p className="text-sm text-gray-400 mt-1">Be the first to create one for your friends.</p>
        </div>
      )}

      {events.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e) => (
              <EventCard key={e.id} event={e} onDeleted={handleDeleted} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-full bg-gray-100 dark:bg-surface-dark-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </AppLayout>
  );
}
