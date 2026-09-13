import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ArrowLeft, PackageX, MapPin, MessageCircle, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { GET_LISTING, MARK_LISTING_SOLD, RELIST_LISTING, DELETE_LISTING } from '@/lib/graphql';
import { AppLayout } from './Home';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore, useUIStore } from '@/store';
import { cn } from '@/utils';

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

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like New',
  GOOD: 'Good',
  FAIR: 'Fair',
};

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { openChatWithUser } = useUIStore();

  const { data, loading, error } = useQuery(GET_LISTING, { variables: { id }, skip: !id });
  const [markSold, { loading: marking }] = useMutation(MARK_LISTING_SOLD);
  const [relist, { loading: relisting }] = useMutation(RELIST_LISTING);
  const [deleteListing, { loading: deleting }] = useMutation(DELETE_LISTING);

  const [activeImage, setActiveImage] = useState(0);

  const listing = data?.marketplaceListing;
  const isSeller = currentUser?.id === listing?.seller?.id;
  const isSold = listing?.status === 'SOLD';
  const busy = marking || relisting || deleting;

  const handleToggleSold = useCallback(async () => {
    if (busy || !listing) return;
    try {
      if (isSold) await relist({ variables: { id: listing.id } });
      else await markSold({ variables: { id: listing.id } });
    } catch {
      toast.error('Something went wrong');
    }
  }, [busy, listing, isSold, relist, markSold]);

  const handleDelete = useCallback(async () => {
    if (busy || !listing) return;
    if (!window.confirm("Delete this listing? This can't be undone.")) return;
    try {
      await deleteListing({ variables: { id: listing.id } });
      toast.success('Listing deleted');
      navigate('/marketplace');
    } catch {
      toast.error('Could not delete listing');
    }
  }, [busy, listing, deleteListing, navigate]);

  const handleMessageSeller = useCallback(() => {
    if (!listing?.seller) return;
    // Reuses the same "start a chat" entry point as Profile.tsx/Friends.tsx
    // (the floating ChatPanel's pendingRecipient flow) instead of building
    // a parallel messaging path just for Marketplace — a seller getting a
    // question about a listing is an ordinary DM, not a distinct feature.
    openChatWithUser({
      id: listing.seller.id,
      fullName: listing.seller.fullName,
      avatar: listing.seller.avatar,
      isOnline: listing.seller.isOnline,
      username: listing.seller.username,
    });
  }, [listing, openChatWithUser]);

  const images: string[] = listing?.images ?? [];

  return (
    <AppLayout>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      {loading && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden animate-pulse">
          <div className="h-72 w-full bg-gray-200 dark:bg-surface-dark-3" />
          <div className="p-5 space-y-3">
            <div className="h-5 w-1/3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 dark:bg-surface-dark-3 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-surface-dark-3 rounded" />
          </div>
        </div>
      )}

      {!loading && (error || !listing) && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-10 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center mb-4">
            <PackageX size={24} className="text-gray-400" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">Listing not found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
            This listing may have been deleted, or you may not have permission to view it.
          </p>
          <Link
            to="/marketplace"
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Back to Marketplace
          </Link>
        </div>
      )}

      {!loading && listing && (
        <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden">
          <div className="relative aspect-[4/3] sm:aspect-[16/9] bg-gray-100 dark:bg-surface-dark-3">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt={listing.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <PackageX size={40} className="text-gray-300 dark:text-gray-600" />
              </div>
            )}
            {isSold && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="px-4 py-1.5 bg-white text-gray-900 text-sm font-bold rounded-full uppercase tracking-wide">
                  Sold
                </span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors',
                    activeImage === i ? 'border-brand-500' : 'border-transparent'
                  )}
                >
                  <img src={img} className="w-full h-full object-cover" alt={`${listing.title} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(listing.price)}</p>
                <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mt-1">{listing.title}</h1>
              </div>
              {isSeller && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleToggleSold}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-surface-dark-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {isSold ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                    {isSold ? 'Relist' : 'Mark as sold'}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-gray-300 font-medium">
                {CATEGORY_LABELS[listing.category] ?? listing.category}
              </span>
              <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-surface-dark-3 text-gray-600 dark:text-gray-300 font-medium">
                {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </span>
            </div>

            {listing.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <MapPin size={16} className="flex-shrink-0" />
                {listing.location}
              </div>
            )}

            <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{listing.description}</p>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
              <Link to={`/profile/${listing.seller?.username}`} className="flex items-center gap-2">
                <Avatar src={listing.seller?.avatar} name={listing.seller?.fullName ?? ''} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{listing.seller?.fullName}</p>
                  <p className="text-xs text-gray-400">Seller</p>
                </div>
              </Link>

              {!isSeller && (
                <button
                  onClick={handleMessageSeller}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <MessageCircle size={15} /> Message Seller
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
