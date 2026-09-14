import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Smile, MapPin, X, Globe, Users, Lock, Loader2, Check } from 'lucide-react';
import { CREATE_POST, GET_FEED } from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore } from '@/store';
import { cn, uploadMedia, type UploadedMedia } from '@/utils';
import toast from 'react-hot-toast';

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC',  label: 'Public',   icon: Globe,  desc: 'Anyone can see this' },
  { value: 'FRIENDS', label: 'Friends',  icon: Users,  desc: 'Your friends only' },
  { value: 'PRIVATE', label: 'Only me',  icon: Lock,   desc: 'Just you' },
];

const FEELINGS = [
  '😊 happy', '😍 loved', '😎 cool', '🤔 thoughtful',
  '🥳 celebrating', '😴 tired', '💪 motivated', '🙏 grateful',
];

const MAX_ATTACHMENTS = 4;
const MAX_FILE_SIZE_MB = 25;

interface PendingMedia {
  id: string;
  file: File;
  previewUrl: string;
  uploading: boolean;
  error: string | null;
  uploaded: UploadedMedia | null;
}

export function CreatePost() {
  const { user } = useAuthStore();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [feeling, setFeeling] = useState('');
  const [location, setLocation] = useState('');
  const [showVisibility, setShowVisibility] = useState(false);
  const [showFeelings, setShowFeelings] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInDraft, setCheckInDraft] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkInInputRef = useRef<HTMLInputElement>(null);
  const checkInPopoverRef = useRef<HTMLDivElement>(null);

  const [createPost, { loading }] = useMutation(CREATE_POST, {
    update(cache, { data }) {
      const newPost = data?.createPost;
      if (!newPost) return;
      // Prepend to feed cache
      const existing = cache.readQuery<any>({ query: GET_FEED, variables: { limit: 10 } });
      if (existing) {
        cache.writeQuery({
          query: GET_FEED,
          variables: { limit: 10 },
          data: {
            feed: {
              ...existing.feed,
              posts: [newPost, ...(existing.feed?.posts ?? [])],
              total: (existing.feed?.total ?? 0) + 1,
            },
          },
        });
      }
    },
  });

  const handleExpand = useCallback(() => {
    setExpanded(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Close the check-in popover on outside click / Escape, and autofocus its
  // input when opened — same UX contract native prompt()/confirm() give you
  // "for free", implemented without blocking the whole page or looking like
  // browser chrome.
  useEffect(() => {
    if (!showCheckIn) return;
    checkInInputRef.current?.focus();

    const handleClickOutside = (e: MouseEvent) => {
      if (checkInPopoverRef.current && !checkInPopoverRef.current.contains(e.target as Node)) {
        setShowCheckIn(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCheckIn(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCheckIn]);

  const handleOpenCheckIn = useCallback(() => {
    setCheckInDraft(location); // prefill so re-opening to edit shows the current value
    setShowCheckIn((v) => !v);
    if (!expanded) setExpanded(true);
  }, [location, expanded]);

  const handleConfirmCheckIn = useCallback(() => {
    const trimmed = checkInDraft.trim();
    if (!trimmed) return;
    setLocation(trimmed);
    setShowCheckIn(false);
  }, [checkInDraft]);

  const handleReset = useCallback(() => {
    setContent('');
    setFeeling('');
    setLocation('');
    setExpanded(false);
    setShowFeelings(false);
    setShowVisibility(false);
    setShowCheckIn(false);
    setCheckInDraft('');
    pendingMedia.forEach((m) => URL.revokeObjectURL(m.previewUrl));
    setPendingMedia([]);
  }, [pendingMedia]);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = MAX_ATTACHMENTS - pendingMedia.length;
    if (remainingSlots <= 0) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files per post`);
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    if (!expanded) setExpanded(true);

    for (const file of selected) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast.error(`${file.name}: only images and videos are supported`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: must be under ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      setPendingMedia((prev) => [...prev, { id, file, previewUrl, uploading: true, error: null, uploaded: null }]);

      uploadMedia(file)
        .then((uploaded) => {
          setPendingMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, uploaded } : m)));
        })
        .catch((err: Error) => {
          setPendingMedia((prev) => prev.map((m) => (m.id === id ? { ...m, uploading: false, error: err.message } : m)));
          toast.error(`${file.name}: ${err.message}`);
        });
    }
  }, [expanded, pendingMedia.length]);

  const handleRemoveMedia = useCallback((id: string) => {
    setPendingMedia((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const readyMedia = pendingMedia.filter((m) => m.uploaded).map((m) => m.uploaded!);
    const stillUploading = pendingMedia.some((m) => m.uploading);
    if ((!content.trim() && readyMedia.length === 0) || loading) return;
    if (stillUploading) {
      toast.error('Still uploading — hang on a sec');
      return;
    }
    try {
      await createPost({
        variables: {
          input: {
            content: content.trim(),
            visibility,
            feeling: feeling || undefined,
            location: location.trim() || undefined,
            media: readyMedia.length
              ? readyMedia.map(({ url, type }) => ({ url, type }))
              : undefined,
          },
        },
      });
      handleReset();
      toast.success('Post shared!');
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to create post');
    }
  }, [content, visibility, feeling, location, loading, createPost, handleReset, pendingMedia]);

  const hasUploadingMedia = pendingMedia.some((m) => m.uploading);
  const hasReadyMedia = pendingMedia.some((m) => m.uploaded);
  const canSubmit = (content.trim().length > 0 || hasReadyMedia) && !loading && !hasUploadingMedia;
  const charCount = content.length;
  const charLimit = 63206;
  const visOpt = VISIBILITY_OPTIONS.find((v) => v.value === visibility)!;
  const VisIcon = visOpt.icon;

  return (
    <div className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark p-4">
      {/* Collapsed trigger */}
      <div className="flex items-center gap-3">
        <Avatar src={user?.avatar} name={user?.fullName ?? 'User'} size="md" />
        <button
          onClick={handleExpand}
          className="flex-1 bg-gray-100 dark:bg-surface-dark-3 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full px-4 py-2.5 text-left text-sm text-gray-400 transition-colors"
        >
          What's on your mind, {user?.firstName}?
        </button>
      </div>

      {/* Expanded composer */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-3 overflow-hidden"
          >
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                if (e.target.value.length <= charLimit) {
                  setContent(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }
              }}
              placeholder={`What's on your mind, ${user?.firstName}?`}
              rows={3}
              maxLength={charLimit}
              className="w-full bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 outline-none resize-none text-lg leading-relaxed min-h-[72px]"
            />

            {/* Char counter */}
            {charCount > charLimit * 0.8 && (
              <p className={cn(
                'text-xs text-right mt-1 tabular-nums',
                charCount > charLimit * 0.95 ? 'text-red-500' : 'text-gray-400'
              )}>
                {charLimit - charCount} remaining
              </p>
            )}

            {/* Tags */}
            {(feeling || location) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {feeling && (
                  <span className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-brand-500 text-sm rounded-full px-3 py-1">
                    {feeling}
                    <button onClick={() => setFeeling('')} aria-label="Remove feeling">
                      <X size={12} />
                    </button>
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 text-sm rounded-full px-3 py-1">
                    <MapPin size={11} />{location}
                    <button onClick={() => setLocation('')} aria-label="Remove location">
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Media previews */}
            {pendingMedia.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {pendingMedia.map((m) => (
                  <div key={m.id} className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-surface-dark-3 aspect-video group">
                    {m.file.type.startsWith('video/') ? (
                      <video src={m.previewUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    {m.uploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 size={22} className="text-white animate-spin" />
                      </div>
                    )}
                    {m.error && (
                      <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center p-2">
                        <p className="text-white text-xs text-center">{m.error}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveMedia(m.id)}
                      aria-label="Remove attachment"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Feelings picker */}
            <AnimatePresence>
              {showFeelings && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-2 grid grid-cols-2 gap-1 bg-gray-50 dark:bg-surface-dark-3 rounded-xl p-2"
                >
                  {FEELINGS.map((f) => (
                    <button
                      key={f}
                      onClick={() => { setFeeling(f); setShowFeelings(false); }}
                      className="text-left text-sm px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-surface-dark-2 transition-colors"
                    >
                      {f}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media / action bar */}
      <div className={cn(
        'flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700',
        !expanded && 'border-t-0 pt-0'
      )}>
        <div className="flex items-center gap-0.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = ''; // allow re-selecting the same file
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={pendingMedia.length >= MAX_ATTACHMENTS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Image size={18} className="text-green-500" />
            <span className="hidden sm:inline">Photo/Video</span>
          </button>
          <button
            onClick={() => { setShowFeelings((v) => !v); if (!expanded) setExpanded(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Smile size={18} className="text-yellow-500" />
            <span className="hidden sm:inline">Feeling</span>
          </button>
          <div className="relative" ref={checkInPopoverRef}>
            <button
              onClick={handleOpenCheckIn}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors',
                showCheckIn && 'bg-gray-100 dark:bg-surface-dark-3'
              )}
            >
              <MapPin size={18} className="text-red-500" />
              <span className="hidden sm:inline">Check in</span>
            </button>

            <AnimatePresence>
              {showCheckIn && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-surface-dark-2 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 p-3 z-10"
                >
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Check in</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg px-2.5 py-1.5">
                      <MapPin size={14} className="text-red-500 flex-shrink-0" />
                      <input
                        ref={checkInInputRef}
                        type="text"
                        value={checkInDraft}
                        onChange={(e) => setCheckInDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); handleConfirmCheckIn(); }
                        }}
                        placeholder="Where are you?"
                        maxLength={100}
                        className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={handleConfirmCheckIn}
                      disabled={!checkInDraft.trim()}
                      aria-label="Confirm check-in"
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                    >
                      <Check size={15} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Visibility picker */}
          <div className="relative">
            <button
              onClick={() => setShowVisibility((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-surface-dark-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
            >
              <VisIcon size={13} />
              <span>{visOpt.label}</span>
            </button>
            <AnimatePresence>
              {showVisibility && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 bottom-full mb-2 w-52 bg-white dark:bg-surface-dark-2 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-10"
                >
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = visibility === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { setVisibility(opt.value); setShowVisibility(false); }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 transition-colors text-left',
                          isSelected && 'bg-blue-50/70 dark:bg-blue-900/20'
                        )}
                      >
                        <Icon size={17} className={isSelected ? 'text-brand-500' : 'text-gray-500'} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.desc}</p>
                        </div>
                        {isSelected && <span className="ml-auto text-brand-500 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {expanded && (
            <>
              <button
                onClick={handleReset}
                className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-dark-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Post
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
