import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { GET_STORIES } from '@/lib/graphql';
import { CreateStoryModal } from '@/components/Stories/CreateStoryModal';
import { Avatar } from '@/components/UI/Avatar';
import { StorySkeleton } from '@/components/UI/Skeleton';
import { useAuthStore } from '@/store';
import { cn } from '@/utils';
import { gql } from '@apollo/client';

const VIEW_STORY = gql`
  mutation ViewStory($storyId: ID!) {
    viewStory(storyId: $storyId) { id viewsCount hasViewed }
  }
`;

// ── Story progress bar ────────────────────────────────────────────────────────

function ProgressBar({ total, current, duration = 5 }: { total: number; current: number; duration?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
          {i < current ? (
            <div className="h-full w-full bg-white" />
          ) : i === current ? (
            <motion.div
              className="h-full bg-white origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration, ease: 'linear' }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Full-screen viewer ────────────────────────────────────────────────────────

interface ViewerProps {
  groups: any[];
  initialGroupIdx: number;
  onClose: () => void;
}

function StoryViewer({ groups, initialGroupIdx, onClose }: ViewerProps) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);
  const [viewStory] = useMutation(VIEW_STORY);

  const group = groups[groupIdx];
  const story = group?.stories?.[storyIdx];
  const STORY_DURATION = story?.media?.type === 'video' ? (story.media.duration ?? 10) : 5;

  // Auto-advance
  useEffect(() => {
    if (!story) return;
    const t = setTimeout(() => advance(), STORY_DURATION * 1000);
    return () => clearTimeout(t);
  }, [groupIdx, storyIdx]);

  // Mark viewed
  useEffect(() => {
    if (story?.id && !story.hasViewed) {
      viewStory({ variables: { storyId: story.id } }).catch(() => {});
    }
  }, [story?.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') advance();
      if (e.key === 'ArrowLeft') retreat();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [groupIdx, storyIdx]);

  const advance = useCallback(() => {
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [storyIdx, groupIdx, group?.stories?.length, groups.length, onClose]);

  const retreat = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStoryIdx(0);
    }
  }, [storyIdx, groupIdx]);

  if (!group || !story) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      {/* Viewer card */}
      <div
        className="relative w-[360px] h-[640px] rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media background */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: story.backgroundColor ?? '#1877F2' }}
        >
          {story.media?.url && story.media.type === 'video' ? (
            <video
              src={story.media.url}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-cover"
            />
          ) : story.media?.url ? (
            <img src={story.media.url} alt="Story" className="w-full h-full object-cover" />
          ) : null}
        </div>

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/30 pointer-events-none" />

        {/* Top chrome */}
        <div className="absolute top-3 left-3 right-3 z-10 space-y-2">
          <ProgressBar total={group.stories.length} current={storyIdx} duration={STORY_DURATION} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={group.user.avatar} name={group.user.fullName} size="sm" />
              <div>
                <p className="text-white font-semibold text-sm leading-none">{group.user.fullName}</p>
                <p className="text-white/70 text-xs mt-0.5">{story.viewsCount ?? 0} views</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close story" className="text-white hover:text-gray-300 p-1">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Text overlay */}
        {story.text && (
          <div className="absolute inset-x-0 bottom-24 flex items-center justify-center px-6">
            <p className="text-white text-2xl font-bold text-center drop-shadow-lg leading-snug">
              {story.text}
            </p>
          </div>
        )}

        {/* Tap zones + arrow buttons */}
        <button
          aria-label="Previous story"
          onClick={retreat}
          className="absolute inset-y-0 left-0 w-1/3 flex items-center pl-2 opacity-0 hover:opacity-100 transition-opacity"
        >
          {(storyIdx > 0 || groupIdx > 0) && (
            <div className="bg-black/30 rounded-full p-1.5">
              <ChevronLeft size={20} className="text-white" />
            </div>
          )}
        </button>
        <button
          aria-label="Next story"
          onClick={advance}
          className="absolute inset-y-0 right-0 w-1/3 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 transition-opacity"
        >
          <div className="bg-black/30 rounded-full p-1.5">
            <ChevronRight size={20} className="text-white" />
          </div>
        </button>

        {/* Sibling group navigation */}
        {groupIdx > 0 && (
          <button
            onClick={() => { setGroupIdx((i) => i - 1); setStoryIdx(0); }}
            aria-label="Previous person's story"
            className="absolute left-[-56px] top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronLeft size={40} />
          </button>
        )}
        {groupIdx < groups.length - 1 && (
          <button
            onClick={() => { setGroupIdx((i) => i + 1); setStoryIdx(0); }}
            aria-label="Next person's story"
            className="absolute right-[-56px] top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronRight size={40} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Stories bar ───────────────────────────────────────────────────────────────

export function StoriesBar() {
  const { user } = useAuthStore();
  const [viewerGroupIdx, setViewerGroupIdx] = useState<number | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const { data, loading } = useQuery(GET_STORIES);

  const groups: any[] = data?.stories ?? [];

  return (
    <>
      <div
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none' }}
        aria-label="Stories"
      >
        {/* Add your story */}
        <div
          onClick={() => setShowCreateStory(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowCreateStory(true); }}
          className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group"
        >
          <div className="relative">
            {/* Smaller circle on phones — this bar was eating a lot of
                vertical space on mobile, mostly from the avatar height. */}
            <Avatar
              src={user?.avatar}
              name={user?.fullName ?? 'Me'}
              size="lg"
              sizeClassName="w-10 h-10 text-xs sm:w-12 sm:h-12 sm:text-base"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-brand-500 rounded-full flex items-center justify-center border-2 border-white dark:border-surface-dark-2 group-hover:bg-brand-600 transition-colors">
              <Plus size={9} className="text-white sm:hidden" />
              <Plus size={11} className="text-white hidden sm:block" />
            </div>
          </div>
          <span className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 w-12 sm:w-14 text-center truncate font-medium">
            Add Story
          </span>
        </div>

        {/* Story groups */}
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <StorySkeleton key={i} />)
          : groups.map((group, idx) => (
              <button
                key={group.user.id}
                onClick={() => setViewerGroupIdx(idx)}
                className="flex flex-col items-center gap-1 flex-shrink-0 group"
                aria-label={`${group.user.firstName}'s story${group.hasUnviewed ? ' (new)' : ''}`}
              >
                <div
                  className={cn(
                    'p-[2px] rounded-full',
                    group.hasUnviewed
                      ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  )}
                >
                  <div className="p-[2px] bg-white dark:bg-surface-dark-2 rounded-full">
                    <Avatar
                      src={group.user.avatar}
                      name={group.user.fullName}
                      size="lg"
                      sizeClassName="w-10 h-10 text-xs sm:w-12 sm:h-12 sm:text-base"
                    />
                  </div>
                </div>
                <span className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 w-12 sm:w-14 text-center truncate">
                  {group.user.firstName}
                </span>
              </button>
            ))}
      </div>

      {/* Viewer overlay */}
      <AnimatePresence>
        {viewerGroupIdx !== null && groups.length > 0 && (
          <StoryViewer
            groups={groups}
            initialGroupIdx={viewerGroupIdx}
            onClose={() => setViewerGroupIdx(null)}
          />
        )}
      </AnimatePresence>

      {/* Create story overlay */}
      <AnimatePresence>
        {showCreateStory && (
          <CreateStoryModal onClose={() => setShowCreateStory(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
