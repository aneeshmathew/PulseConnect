import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Volume2, VolumeX, MoreHorizontal, Send, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  REACT_TO_VIDEO, REMOVE_VIDEO_REACTION, COMMENT_ON_VIDEO, INCREMENT_VIDEO_VIEW, DELETE_VIDEO,
} from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore } from '@/store';
import { timeAgo, cn, formatCount } from '@/utils';

interface VideoCardProps {
  video: any;
  isActive: boolean;
  onDeleted?: (id: string) => void;
}

export function VideoCard({ video, isActive, onDeleted }: VideoCardProps) {
  const { user: currentUser } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef(false);

  const [muted, setMuted] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  const myReaction = video.myReaction;
  const isOwner = currentUser?.id === video.author?.id;

  const [reactToVideo] = useMutation(REACT_TO_VIDEO);
  const [removeVideoReaction] = useMutation(REMOVE_VIDEO_REACTION);
  const [commentOnVideo, { loading: commenting }] = useMutation(COMMENT_ON_VIDEO);
  const [incrementView] = useMutation(INCREMENT_VIDEO_VIEW);
  const [deleteVideo, { loading: deleting }] = useMutation(DELETE_VIDEO);

  // Play/pause driven by the parent's IntersectionObserver (isActive), not
  // by scroll math here — keeps this component dumb and reusable. Count a
  // genuine "view" once per mount, after a couple of seconds of continuous
  // play, rather than on every scroll-past (matches how the resolver's
  // incrementVideoView is documented to be called: once per real view, not
  // once per query).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.play().catch(() => {});
      const t = setTimeout(() => {
        if (!viewedRef.current) {
          viewedRef.current = true;
          incrementView({ variables: { videoId: video.id } }).catch(() => {});
        }
      }, 2000);
      return () => clearTimeout(t);
    }
    el.pause();
  }, [isActive, incrementView, video.id]);

  const handleLike = useCallback(async () => {
    try {
      if (myReaction) await removeVideoReaction({ variables: { videoId: video.id } });
      else await reactToVideo({ variables: { videoId: video.id, type: 'LIKE' } });
    } catch {
      toast.error('Something went wrong');
    }
  }, [myReaction, video.id, reactToVideo, removeVideoReaction]);

  const handleDoubleTap = useCallback(() => {
    if (!myReaction) reactToVideo({ variables: { videoId: video.id, type: 'LIKE' } }).catch(() => {});
  }, [myReaction, reactToVideo, video.id]);

  const handleTogglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const handleComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = commentText.trim();
      if (!text || commenting) return;
      try {
        await commentOnVideo({ variables: { videoId: video.id, content: text } });
        setCommentText('');
      } catch {
        toast.error('Could not post comment');
      }
    },
    [commentText, commenting, commentOnVideo, video.id]
  );

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/watch?v=${video.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  }, [video.id]);

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    if (!window.confirm('Delete this video? This can\'t be undone.')) return;
    try {
      await deleteVideo({ variables: { id: video.id } });
      onDeleted?.(video.id);
      toast.success('Video deleted');
    } catch {
      toast.error('Could not delete video');
    }
  }, [deleting, deleteVideo, video.id, onDeleted]);

  return (
    <div className="relative h-full w-full bg-black rounded-2xl overflow-hidden select-none">
      <video
        ref={videoRef}
        src={video.url}
        poster={video.thumbnail || undefined}
        className="absolute inset-0 h-full w-full object-contain bg-black"
        loop
        muted={muted}
        playsInline
        preload="metadata"
        onDoubleClick={handleDoubleTap}
        onClick={handleTogglePlay}
      />

      {/* Top bar: author + mute + owner menu */}
      <div className="absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between z-10">
        <Link to={`/profile/${video.author?.username}`} className="flex items-center gap-2 min-w-0">
          <Avatar src={video.author?.avatar} name={video.author?.fullName ?? 'Unknown'} size="sm" />
          <span className="text-white text-sm font-semibold drop-shadow truncate">{video.author?.fullName}</span>
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          {isOwner && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((v) => !v)}
                aria-label="Video options"
                aria-expanded={showMenu}
                className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-surface-dark-2 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20">
                  <button
                    onClick={() => { setShowMenu(false); handleDelete(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Caption + view count */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-5 bg-gradient-to-t from-black/70 to-transparent z-10">
        {video.caption && (
          <p className="text-white text-sm mb-1.5 line-clamp-2 drop-shadow">{video.caption}</p>
        )}
        <p className="text-white/70 text-xs">
          {formatCount(video.viewCount)} views · {timeAgo(video.createdAt)}
        </p>
      </div>

      {/* Right action rail: like / comment / share */}
      <div className="absolute right-3 bottom-6 flex flex-col items-center gap-5 z-10">
        <button onClick={handleLike} aria-label={myReaction ? 'Unlike video' : 'Like video'} className="flex flex-col items-center gap-1">
          <span
            className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90',
              myReaction ? 'bg-red-500' : 'bg-black/40'
            )}
          >
            <Heart size={20} className="text-white" fill={myReaction ? 'white' : 'none'} />
          </span>
          <span className="text-white text-xs font-medium drop-shadow">{formatCount(video.reactionsCount)}</span>
        </button>

        <button onClick={() => setShowComments(true)} aria-label="View comments" className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <MessageCircle size={20} className="text-white" />
          </span>
          <span className="text-white text-xs font-medium drop-shadow">{formatCount(video.commentsCount)}</span>
        </button>

        <button onClick={handleShare} aria-label="Copy link to video" className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/40 flex items-center justify-center">
            <Share2 size={18} className="text-white" />
          </span>
        </button>
      </div>

      {/* Comments bottom sheet */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 z-20"
              onClick={() => setShowComments(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="absolute bottom-0 inset-x-0 z-30 bg-white dark:bg-surface-dark-2 rounded-t-2xl max-h-[75%] flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {formatCount(video.commentsCount)} comments
                </h3>
                <button
                  onClick={() => setShowComments(false)}
                  aria-label="Close comments"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {(video.comments ?? []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No comments yet. Be the first!</p>
                )}
                {(video.comments ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <Avatar src={c.author?.avatar} name={c.author?.fullName ?? 'Unknown'} size="xs" />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold text-gray-900 dark:text-white mr-1">{c.author?.fullName}</span>
                        <span className="text-gray-700 dark:text-gray-300">{c.content}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(c.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleComment}
                className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0"
              >
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  aria-label="Add a comment"
                  className="flex-1 bg-gray-100 dark:bg-surface-dark-3 rounded-full px-4 py-2 text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || commenting}
                  aria-label="Post comment"
                  className="text-brand-500 disabled:text-gray-300 dark:disabled:text-gray-600 transition-colors"
                >
                  <Send size={18} />
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
