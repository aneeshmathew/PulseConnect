import { useState, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { Plus, Store } from 'lucide-react';
import { GET_MARKETPLACE_LISTINGS } from '@/lib/graphql';
import { AppLayout } from './Home';
import { ListingCard } from '@/components/Marketplace/ListingCard';
import { CreateListingModal } from '@/components/Marketplace/CreateListingModal';
import { cn } from '@/utils';

// Must match CreateListingModal's LISTINGS_LIMIT — its cache.writeQuery
// prepend keys on this exact `limit` variable.
const LISTINGS_LIMIT = 12;

const CATEGORY_TABS = [
  { value: null, label: 'All' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'HOME_GARDEN', label: 'Home & Garden' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'TOYS_GAMES', label: 'Toys & Games' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function MarketplacePage() {
  const [category, setCategory] = useState<string | null>(null);
  const { data, loading, fetchMore } = useQuery(GET_MARKETPLACE_LISTINGS, {
    variables: { category, limit: LISTINGS_LIMIT },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);

  const listings: any[] = (data?.marketplaceListings?.listings ?? []).filter(
    (l: any) => l && !removedIds.has(l.id)
  );
  const hasMore = data?.marketplaceListings?.hasMore;
  const nextCursor = data?.marketplaceListings?.nextCursor;

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchMore({ variables: { category, cursor: nextCursor, limit: LISTINGS_LIMIT } });
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, category, nextCursor, fetchMore]);

  // A listing marked sold/relisted stays in the grid (its card re-renders
  // via the normalized cache write from the mutation) — only an actual
  // delete needs to be tracked and filtered out locally, same as
  // EventsPage's `deletedIds` / EventCard's `onDeleted`.
  const handleDeleted = useCallback((id: string) => {
    setRemovedIds((prev) => new Set(prev).add(id));
  }, []);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Store size={22} className="text-brand-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Marketplace</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Create listing
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-1 px-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setCategory(tab.value)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap',
              category === tab.value
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 dark:bg-surface-dark-3 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && listings.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-200 dark:bg-surface-dark-3 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      )}

      {!loading && listings.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center rounded-2xl bg-white dark:bg-surface-dark-2 border border-gray-100 dark:border-gray-700">
          <Store size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">No listings yet</p>
          <p className="text-sm text-gray-400 mt-1">Be the first to sell something to your community.</p>
        </div>
      )}

      {listings.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} onDeleted={handleDeleted} />
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

      {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} />}
    </AppLayout>
  );
}
