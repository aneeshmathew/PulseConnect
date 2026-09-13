import { useState, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { MapPin, Tag, MoreHorizontal, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { MARK_LISTING_SOLD, RELIST_LISTING, DELETE_LISTING } from '@/lib/graphql';
import { useAuthStore } from '@/store';

// Marketplace prices are always whole-dollar-friendly, unlike e.g. stock
// prices — Intl.NumberFormat with no decimals matches how every real
// classifieds site displays a listing price ("$350", not "$350.00").
function formatPrice(price: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    price
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRONICS: 'Electronics',
  VEHICLES: 'Vehicles',
  HOME_GARDEN: 'Home & Garden',
  CLOTHING: 'Clothing',
  FURNITURE: 'Furniture',
  TOYS_GAMES: 'Toys & Games',
  OTHER: 'Other',
};

interface ListingCardProps {
  listing: any;
  onDeleted?: (id: string) => void;
  onChanged?: (updated: any) => void;
}

export function ListingCard({ listing, onDeleted, onChanged }: ListingCardProps) {
  const { user: currentUser } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const isSeller = currentUser?.id === listing.seller?.id;
  const isSold = listing.status === 'SOLD';

  const [markSold, { loading: marking }] = useMutation(MARK_LISTING_SOLD);
  const [relist, { loading: relisting }] = useMutation(RELIST_LISTING);
  const [deleteListing, { loading: deleting }] = useMutation(DELETE_LISTING);

  const busy = marking || relisting || deleting;

  const handleToggleSold = useCallback(async () => {
    if (busy) return;
    setShowMenu(false);
    try {
      const { data } = isSold
        ? await relist({ variables: { id: listing.id } })
        : await markSold({ variables: { id: listing.id } });
      const updated = data?.relistListing ?? data?.markListingSold;
      if (updated) onChanged?.(updated);
    } catch {
      toast.error('Something went wrong');
    }
  }, [busy, isSold, relist, markSold, listing.id, onChanged]);

  const handleDelete = useCallback(async () => {
    if (busy) return;
    setShowMenu(false);
    if (!window.confirm("Delete this listing? This can't be undone.")) return;
    try {
      await deleteListing({ variables: { id: listing.id } });
      onDeleted?.(listing.id);
      toast.success('Listing deleted');
    } catch {
      toast.error('Could not delete listing');
    }
  }, [busy, deleteListing, listing.id, onDeleted]);

  return (
    <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden flex flex-col">
      <Link to={`/listing/${listing.id}`} className="block relative aspect-square bg-gray-100 dark:bg-surface-dark-3">
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag size={28} className="text-gray-300 dark:text-gray-600" />
          </div>
        )}
        {isSold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="px-3 py-1 bg-white text-gray-900 text-xs font-bold rounded-full uppercase tracking-wide">
              Sold
            </span>
          </div>
        )}
      </Link>

      <div className="p-3 flex flex-col gap-1 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-gray-900 dark:text-white">{formatPrice(listing.price)}</p>
          {isSeller && (
            <div className="relative flex-shrink-0 -mt-1 -mr-1">
              <button
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Listing options"
                className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-surface-dark-2 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                  <button
                    onClick={handleToggleSold}
                    disabled={busy}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors disabled:opacity-50"
                  >
                    {isSold ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                    {isSold ? 'Relist' : 'Mark as sold'}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <Link to={`/listing/${listing.id}`}>
          <h3 className="text-sm text-gray-700 dark:text-gray-200 leading-snug line-clamp-2 hover:underline">
            {listing.title}
          </h3>
        </Link>

        {listing.location && (
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-auto pt-1">
            <MapPin size={12} className="flex-shrink-0" />
            <span className="truncate">{listing.location}</span>
          </div>
        )}
        <span className="text-xs text-gray-400">{CATEGORY_LABELS[listing.category] ?? listing.category}</span>
      </div>
    </div>
  );
}
