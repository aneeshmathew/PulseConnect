import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { X, Film, Loader2, Globe2, Users, Lock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { CREATE_VIDEO, GET_WATCH_FEED } from '@/lib/graphql';
import { uploadMedia, cn } from '@/utils';

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe2 },
  { value: 'FRIENDS', label: 'Friends', icon: Users },
  { value: 'PRIVATE', label: 'Only me', icon: Lock },
] as const;

// Must match the `limit` Watch.tsx passes to its initial GET_WATCH_FEED
// query — cache.readQuery/writeQuery below key on exact variables, same
// convention as CreatePost.tsx's GET_FEED cache prepend.
const WATCH_FEED_LIMIT = 6;

interface CreateVideoModalProps {
  onClose: () => void;
}

export function CreateVideoModal({ onClose }: CreateVideoModalProps) {
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC');
  const [showVisibility, setShowVisibility] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ previewUrl: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ url: string; duration?: number; width?: number; height?: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [createVideo, { loading: posting }] = useMutation(CREATE_VIDEO, {
    update(cache, { data }) {
      const newVideo = data?.createVideo;
      if (!newVideo) return;
      const existing = cache.readQuery<any>({ query: GET_WATCH_FEED, variables: { limit: WATCH_FEED_LIMIT } });
      if (existing) {
        cache.writeQuery({
          query: GET_WATCH_FEED,
          variables: { limit: WATCH_FEED_LIMIT },
          data: {
            watchFeed: {
              ...existing.watchFeed,
              videos: [newVideo, ...(existing.watchFeed?.videos ?? [])],
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
    return () => { if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl); };
  }, [pendingFile]);

  const handleFileSelected = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please choose a video file');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('Video must be under 100MB');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ previewUrl, file });
    setUploaded(null);
    setUploading(true);
    uploadMedia(file)
      .then((result) => {
        const el = videoPreviewRef.current;
        setUploaded({
          url: result.url,
          duration: el?.duration && Number.isFinite(el.duration) ? Math.round(el.duration) : undefined,
          width: el?.videoWidth || undefined,
          height: el?.videoHeight || undefined,
        });
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Upload failed');
        setPendingFile(null);
      })
      .finally(() => setUploading(false));
  }, []);

  const canPost = !!uploaded && !uploading && !posting;

  const handlePost = useCallback(async () => {
    if (!canPost) return;
    try {
      await createVideo({
        variables: {
          input: {
            url: uploaded!.url,
            caption: caption.trim() || undefined,
            duration: uploaded!.duration,
            width: uploaded!.width,
            height: uploaded!.height,
            visibility,
          },
        },
      });
      toast.success('Video posted!');
      onClose();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to post video');
    }
  }, [canPost, createVideo, uploaded, caption, visibility, onClose]);

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
        className="relative w-[380px] max-h-[90vh] bg-white dark:bg-surface-dark-2 rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h2 className="font-bold text-gray-900 dark:text-white">Upload video</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <div className="relative w-full aspect-[9/16] max-h-[45vh] mx-auto rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center">
            {pendingFile ? (
              <>
                <video
                  ref={videoPreviewRef}
                  src={pendingFile.previewUrl}
                  className="w-full h-full object-contain bg-black"
                  muted
                  autoPlay
                  loop
                  playsInline
                />
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
                <Film size={32} />
                <span className="text-sm font-medium">Choose a video</span>
                <span className="text-xs text-gray-400">Up to 100MB, vertical works best</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          {pendingFile && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-2 py-2 text-xs font-semibold text-brand-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded-lg transition-colors"
            >
              Choose a different video
            </button>
          )}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            maxLength={2200}
            rows={2}
            className="w-full mt-3 px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />

          {/* Visibility */}
          <div className="relative mt-2">
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
            onClick={handlePost}
            disabled={!canPost}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {posting ? 'Posting…' : uploading ? 'Uploading…' : 'Post'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
