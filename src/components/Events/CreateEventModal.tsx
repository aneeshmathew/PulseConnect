import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { X, Calendar, Image as ImageIcon, Loader2, Globe2, Users, Lock, ChevronDown, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { CREATE_EVENT, GET_UPCOMING_EVENTS } from '@/lib/graphql';
import { uploadMedia, cn } from '@/utils';

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe2 },
  { value: 'FRIENDS', label: 'Friends', icon: Users },
  { value: 'PRIVATE', label: 'Only me', icon: Lock },
] as const;

// Must match the `limit` EventsPage passes to its initial GET_UPCOMING_EVENTS
// query — cache.readQuery/writeQuery below key on exact variables, same
// convention as CreateVideoModal's GET_WATCH_FEED prepend.
const EVENTS_LIMIT = 9;

// <input type="datetime-local"> works in the browser's local time and
// needs "YYYY-MM-DDTHH:mm" with no timezone suffix — new Date().toISOString()
// gives UTC with a trailing "Z", so this strips/adjusts for the input's
// expected local-time format. Converting back to a real Date (and then to
// an ISO string for the mutation) happens in handleCreate below.
function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

interface CreateEventModalProps {
  onClose: () => void;
}

export function CreateEventModal({ onClose }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setMinutes(0, 0, 0);
    return toLocalInputValue(d);
  });
  const [endAt, setEndAt] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC');
  const [showVisibility, setShowVisibility] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createEvent, { loading: posting }] = useMutation(CREATE_EVENT, {
    update(cache, { data }) {
      const newEvent = data?.createEvent;
      if (!newEvent) return;
      const existing = cache.readQuery<any>({ query: GET_UPCOMING_EVENTS, variables: { limit: EVENTS_LIMIT } });
      if (existing) {
        cache.writeQuery({
          query: GET_UPCOMING_EVENTS,
          variables: { limit: EVENTS_LIMIT },
          data: {
            upcomingEvents: {
              ...existing.upcomingEvents,
              events: [newEvent, ...(existing.upcomingEvents?.events ?? [])],
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
    return () => { if (coverPreview) URL.revokeObjectURL(coverPreview); };
  }, [coverPreview]);

  const handleFileSelected = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Image must be under 15MB');
      return;
    }
    setCoverPreview(URL.createObjectURL(file));
    setCoverUrl(null);
    setUploading(true);
    uploadMedia(file)
      .then((result) => setCoverUrl(result.url))
      .catch((err: Error) => {
        toast.error(err.message || 'Upload failed');
        setCoverPreview(null);
      })
      .finally(() => setUploading(false));
  }, []);

  const canPost = !!title.trim() && !!startAt && !uploading && !posting;

  const handleCreate = useCallback(async () => {
    if (!canPost) return;
    const startDate = new Date(startAt);
    const endDate = endAt ? new Date(endAt) : undefined;
    if (endDate && endDate < startDate) {
      toast.error('End time must be after the start time');
      return;
    }
    try {
      await createEvent({
        variables: {
          input: {
            title: title.trim(),
            description: description.trim() || undefined,
            coverImage: coverUrl ?? undefined,
            location: location.trim() || undefined,
            startAt: startDate.toISOString(),
            endAt: endDate?.toISOString(),
            visibility,
          },
        },
      });
      toast.success('Event created!');
      onClose();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to create event');
    }
  }, [canPost, createEvent, title, description, coverUrl, location, startAt, endAt, visibility, onClose]);

  const SelectedIcon = VISIBILITY_OPTIONS.find((o) => o.value === visibility)!.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-[420px] max-h-[90vh] bg-white dark:bg-surface-dark-2 rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white">Create event</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-3">
          <div className="relative w-full aspect-[2/1] rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center">
            {coverPreview ? (
              <>
                <img src={coverPreview} className="w-full h-full object-cover" alt="Cover preview" />
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 size={28} className="text-white animate-spin" />
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 text-gray-400 hover:text-gray-500 transition-colors"
              >
                <ImageIcon size={32} />
                <span className="text-sm font-medium">Add a cover photo</span>
                <span className="text-xs text-gray-400">Optional, up to 15MB</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          {coverPreview && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full -mt-1 py-2 text-xs font-semibold text-brand-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded-lg transition-colors"
            >
              Choose a different photo
            </button>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            maxLength={200}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this event about?"
            maxLength={5000}
            rows={3}
            className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg">
            <MapPin size={16} className="text-gray-400 flex-shrink-0" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              maxLength={300}
              className="w-full bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Starts</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="px-3 py-2 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Ends (optional)</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                min={startAt}
                className="px-3 py-2 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Visibility */}
          <div className="relative">
            <button
              onClick={() => setShowVisibility((v) => !v)}
              aria-expanded={showVisibility}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-surface-dark-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <SelectedIcon size={14} />
              {VISIBILITY_OPTIONS.find((o) => o.value === visibility)!.label}
              <ChevronDown size={14} />
            </button>
            {showVisibility && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-surface-dark-2 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10">
                {VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setVisibility(opt.value); setShowVisibility(false); }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors',
                      visibility === opt.value ? 'text-brand-500 font-semibold' : 'text-gray-700 dark:text-gray-200'
                    )}
                  >
                    <opt.icon size={14} /> {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleCreate}
            disabled={!canPost}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Calendar size={16} />
            {posting ? 'Creating…' : uploading ? 'Uploading…' : 'Create event'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
