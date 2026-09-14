import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { X, ImagePlus, Loader2, Tag, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { CREATE_LISTING, GET_MARKETPLACE_LISTINGS } from '@/lib/graphql';
import { uploadMedia, type UploadedMedia, cn } from '@/utils';

// Mirrors CreatePost's per-item upload tracking (id/file/previewUrl/
// uploading/error/uploaded) — each photo uploads independently and the
// submit button only cares whether at least one has finished.
interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  uploading: boolean;
  error: string | null;
  uploaded: UploadedMedia | null;
}

const MAX_IMAGES = 10;
const MAX_FILE_SIZE_MB = 15;

const CATEGORIES = [
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'VEHICLES', label: 'Vehicles' },
  { value: 'HOME_GARDEN', label: 'Home & Garden' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'TOYS_GAMES', label: 'Toys & Games' },
  { value: 'OTHER', label: 'Other' },
] as const;

const CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'LIKE_NEW', label: 'Like New' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
] as const;

// Must match MarketplacePage's `limit` for GET_MARKETPLACE_LISTINGS — the
// cache.writeQuery prepend below keys on this exact variables shape.
const LISTINGS_LIMIT = 12;

interface CreateListingModalProps {
  onClose: () => void;
}

export function CreateListingModal({ onClose }: CreateListingModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['value']>('OTHER');
  const [condition, setCondition] = useState<(typeof CONDITIONS)[number]['value']>('GOOD');
  const [location, setLocation] = useState('');
  const [showCategory, setShowCategory] = useState(false);
  const [showCondition, setShowCondition] = useState(false);
  const [images, setImages] = useState<PendingImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createListing, { loading: posting }] = useMutation(CREATE_LISTING, {
    update(cache, { data }) {
      const newListing = data?.createListing;
      if (!newListing) return;
      const existing = cache.readQuery<any>({
        query: GET_MARKETPLACE_LISTINGS,
        // Must include `category: null` explicitly — MarketplacePage's
        // "All" tab passes `category: null` in its own query variables
        // (not an omitted variable), and readQuery/writeQuery match on
        // the exact variables object, not on the field policy's keyArgs.
        // Omitting the key here would target a different, empty cache
        // entry and silently drop the prepend for anyone on the "All" tab.
        variables: { category: null, limit: LISTINGS_LIMIT },
      });
      if (existing) {
        cache.writeQuery({
          query: GET_MARKETPLACE_LISTINGS,
          variables: { category: null, limit: LISTINGS_LIMIT },
          data: {
            marketplaceListings: {
              ...existing.marketplaceListings,
              listings: [newListing, ...(existing.marketplaceListings?.listings ?? [])],
            },
          },
        });
      }
    },
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    return () => { images.forEach((img) => URL.revokeObjectURL(img.previewUrl)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      toast.error(`You can add up to ${MAX_IMAGES} photos`);
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    for (const file of selected) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: only images are supported`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: must be under ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setImages((prev) => [...prev, { id, file, previewUrl, uploading: true, error: null, uploaded: null }]);

      uploadMedia(file)
        .then((uploaded) => {
          setImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploading: false, uploaded } : img)));
        })
        .catch((err: Error) => {
          setImages((prev) => prev.map((img) => (img.id === id ? { ...img, uploading: false, error: err.message } : img)));
          toast.error(`${file.name}: ${err.message}`);
        });
    }
  }, [images.length]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const readyImages = images.filter((img) => img.uploaded).map((img) => img.uploaded!.url);
  const stillUploading = images.some((img) => img.uploading);
  const priceValue = parseFloat(price);
  const canPost =
    !!title.trim() && !!description.trim() && !isNaN(priceValue) && priceValue >= 0 &&
    readyImages.length > 0 && !stillUploading && !posting;

  const handleCreate = useCallback(async () => {
    if (!canPost) return;
    try {
      await createListing({
        variables: {
          input: {
            title: title.trim(),
            description: description.trim(),
            price: priceValue,
            category,
            condition,
            images: readyImages,
            location: location.trim() || undefined,
          },
        },
      });
      toast.success('Listing posted!');
      onClose();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to post listing');
    }
  }, [canPost, createListing, title, description, priceValue, category, condition, readyImages, location, onClose]);

  const selectedCategory = CATEGORIES.find((c) => c.value === category)!;
  const selectedCondition = CONDITIONS.find((c) => c.value === condition)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-[440px] max-h-[90vh] bg-white dark:bg-surface-dark-2 rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white">Create listing</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          {/* Photos */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 block">
              Photos ({images.length}/{MAX_IMAGES})
            </label>
            <div className="grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-surface-dark-3">
                  <img src={img.previewUrl} className="w-full h-full object-cover" alt="Listing photo" />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 size={18} className="text-white animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveImage(img.id)}
                    aria-label="Remove photo"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-500 hover:border-gray-400 transition-colors"
                >
                  <ImagePlus size={20} />
                  <span className="text-[10px] font-medium">Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }}
            />
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            maxLength={200}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500"
          />

          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">$</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              inputMode="decimal"
              className="w-full bg-transparent text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
            />
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your item — condition, details, why you're selling"
            maxLength={5000}
            rows={3}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <button
                onClick={() => setShowCategory((v) => !v)}
                className="w-full flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-surface-dark-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="truncate">{selectedCategory.label}</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {showCategory && (
                <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-surface-dark-2 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { setCategory(c.value); setShowCategory(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors',
                        category === c.value ? 'text-brand-500 font-semibold' : 'text-gray-700 dark:text-gray-200'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowCondition((v) => !v)}
                className="w-full flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-surface-dark-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="truncate">{selectedCondition.label}</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {showCondition && (
                <div className="absolute left-0 top-full mt-1 w-full bg-white dark:bg-surface-dark-2 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                  {CONDITIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => { setCondition(c.value); setShowCondition(false); }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors',
                        condition === c.value ? 'text-brand-500 font-semibold' : 'text-gray-700 dark:text-gray-200'
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            maxLength={300}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleCreate}
            disabled={!canPost}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Tag size={16} />
            {posting ? 'Posting…' : stillUploading ? 'Uploading…' : 'Post listing'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
