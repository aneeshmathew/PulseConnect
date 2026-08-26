import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { motion } from 'framer-motion';
import { X, Image, Type, Loader2 } from 'lucide-react';
import { CREATE_STORY, GET_STORIES } from '@/lib/graphql';
import { uploadMedia, cn } from '@/utils';
import toast from 'react-hot-toast';

const BACKGROUND_COLORS = [
  '#1877F2', '#E4405F', '#8B5CF6', '#10B981',
  '#F59E0B', '#EF4444', '#0EA5E9', '#111827',
];

interface CreateStoryModalProps {
  onClose: () => void;
}

export function CreateStoryModal({ onClose }: CreateStoryModalProps) {
  const [mode, setMode] = useState<'photo' | 'text'>('photo');
  const [text, setText] = useState('');
  const [backgroundColor, setBackgroundColor] = useState(BACKGROUND_COLORS[0]);
  const [pendingFile, setPendingFile] = useState<{ previewUrl: string; file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<{ url: string; type: 'IMAGE' | 'VIDEO' | 'GIF' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createStory, { loading: posting }] = useMutation(CREATE_STORY, {
    refetchQueries: [GET_STORIES],
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
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Only images and videos are supported');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File must be under 25MB');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingFile({ previewUrl, file });
    setUploaded(null);
    setUploading(true);
    uploadMedia(file)
      .then((result) => setUploaded({ url: result.url, type: result.type }))
      .catch((err: Error) => {
        toast.error(err.message || 'Upload failed');
        setPendingFile(null);
      })
      .finally(() => setUploading(false));
  }, []);

  const canShare = mode === 'photo' ? !!uploaded && !uploading : text.trim().length > 0;

  const handleShare = useCallback(async () => {
    if (!canShare || posting) return;
    try {
      await createStory({
        variables: {
          input: mode === 'photo'
            ? { mediaUrl: uploaded!.url, mediaType: uploaded!.type === 'VIDEO' ? 'video' : 'image' }
            : { text: text.trim(), backgroundColor },
        },
      });
      toast.success('Story shared!');
      onClose();
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to share story');
    }
  }, [canShare, posting, mode, uploaded, text, backgroundColor, createStory, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative w-[360px] max-h-[90vh] bg-white dark:bg-surface-dark-2 rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-bold text-gray-900 dark:text-white">Create story</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-4 pt-3">
          <button
            onClick={() => setMode('photo')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors',
              mode === 'photo' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-500' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3'
            )}
          >
            <Image size={15} /> Photo/Video
          </button>
          <button
            onClick={() => setMode('text')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors',
              mode === 'text' ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-500' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3'
            )}
          >
            <Type size={15} /> Text
          </button>
        </div>

        {/* Preview area — 9:16-ish, matches the story viewer's aspect */}
        <div className="p-4">
          <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-dark-3 flex items-center justify-center">
            {mode === 'photo' ? (
              pendingFile ? (
                <>
                  {pendingFile.file.type.startsWith('video/') ? (
                    <video src={pendingFile.previewUrl} className="w-full h-full object-cover" muted autoPlay loop />
                  ) : (
                    <img src={pendingFile.previewUrl} alt="" className="w-full h-full object-cover" />
                  )}
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
                  <Image size={32} />
                  <span className="text-sm font-medium">Choose a photo or video</span>
                </button>
              )
            ) : (
              <div
                className="w-full h-full flex items-center justify-center p-6"
                style={{ backgroundColor }}
              >
                <p className="text-white text-2xl font-bold text-center leading-snug break-words">
                  {text || 'Your text goes here'}
                </p>
              </div>
            )}
          </div>

          {mode === 'photo' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              {pendingFile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full mt-2 py-2 text-xs font-semibold text-brand-500 hover:bg-gray-50 dark:hover:bg-surface-dark-3 rounded-lg transition-colors"
                >
                  Choose a different file
                </button>
              )}
            </>
          )}

          {mode === 'text' && (
            <div className="mt-3 space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's on your mind?"
                maxLength={200}
                rows={2}
                className="w-full px-3.5 py-2.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <div className="flex items-center gap-2">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBackgroundColor(color)}
                    aria-label={`Background color ${color}`}
                    className={cn(
                      'w-7 h-7 rounded-full flex-shrink-0 transition-transform',
                      backgroundColor === color && 'ring-2 ring-offset-2 ring-brand-500 dark:ring-offset-surface-dark-2 scale-110'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={handleShare}
            disabled={!canShare || posting}
            className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {posting ? 'Sharing…' : 'Share to Story'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
