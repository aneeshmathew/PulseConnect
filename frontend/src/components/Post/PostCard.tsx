import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp, MessageCircle, Share2, MoreHorizontal,
  Globe, Users, Lock, MapPin, Edit2, Trash2, Bookmark,
  AlertCircle,
} from 'lucide-react';
import { REACT_TO_POST, REMOVE_REACTION, DELETE_POST, SAVE_POST, UNSAVE_POST } from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { CommentSection } from '@/components/Post/CommentSection';
import { timeAgo, cn, REACTION_EMOJIS, REACTION_COLORS } from '@/utils';
import { useAuthStore } from '@/store';
import toast from 'react-hot-toast';

const REACTIONS = ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;

interface Post {
  id: string;
  content?: string;
  author: {
    id: string;
    fullName: string;
    username: string;
    avatar?: string | null;
    isOnline?: boolean;
    isVerified?: boolean;
  };
  media?: { url: string; type: string; thumbnail?: string }[];
  reactionSummary?: { type: string; count: number }[];
  myReaction?: string | null;
  isSaved?: boolean;
  commentsCount?: number;
  sharesCount?: number;
  comments?: any[];
  visibility: string;
  location?: string;
  feeling?: string;
  isEdited?: boolean;
  createdAt: string;
}

interface PostCardProps {
  post: Post;
  // Auto-expands the comment thread on mount — used by the single-post
  // detail page (arrived at via a POST_LIKE/POST_COMMENT notification,
  // where the person almost certainly wants to see the comment right
  // away rather than click "Comment" again to reveal what they came for).
  initiallyExpanded?: boolean;
}

// Memoized so virtual-list siblings don't re-render when one post changes
const PostCard = memo(function PostCard({ post, initiallyExpanded = false }: PostCardProps) {
  const { user } = useAuthStore();
  const [showComments, setShowComments] = useState(initiallyExpanded);
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reactToPost, { loading: reacting }] = useMutation(REACT_TO_POST);
  const [removeReaction] = useMutation(REMOVE_REACTION);
  const [deletePost, { loading: deleting }] = useMutation(DELETE_POST, {
    update(cache) {
      cache.evict({ id: `Post:${post.id}` });
      cache.gc();
    },
  });
  const [savePost] = useMutation(SAVE_POST, {
    optimisticResponse: { savePost: true },
    update(cache) {
      cache.modify({ id: `Post:${post.id}`, fields: { isSaved: () => true } });
    },
  });
  const [unsavePost] = useMutation(UNSAVE_POST, {
    optimisticResponse: { unsavePost: true },
    update(cache) {
      cache.modify({ id: `Post:${post.id}`, fields: { isSaved: () => false } });
    },
  });

  const myReaction = post.myReaction;
  const totalReactions = post.reactionSummary?.reduce((s, r) => s + r.count, 0) ?? 0;
  const isOwner = user?.id === post.author.id;

  const handleReact = useCallback(
    async (type: string) => {
      setShowReactions(false);
      if (reacting) return;
      try {
        if (myReaction === type) {
          await removeReaction({ variables: { postId: post.id } });
        } else {
          await reactToPost({ variables: { postId: post.id, type } });
        }
      } catch {
        toast.error('Failed to react');
      }
    },
    [myReaction, post.id, reacting, reactToPost, removeReaction]
  );

  const handleDelete = useCallback(async () => {
    try {
      await deletePost({ variables: { id: post.id } });
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
    setShowMenu(false);
    setConfirmDelete(false);
  }, [deletePost, post.id]);

  const handleToggleSave = useCallback(async () => {
    setShowMenu(false);
    try {
      if (post.isSaved) {
        await unsavePost({ variables: { postId: post.id } });
        toast.success('Removed from Saved');
      } else {
        await savePost({ variables: { postId: post.id } });
        toast.success('Saved');
      }
    } catch {
      toast.error('Failed to update saved posts');
    }
  }, [post.isSaved, post.id, savePost, unsavePost]);

  const onReactionEnter = useCallback(() => {
    // Always clear whatever's pending first — this is what makes hover
    // reliable in both directions. Previously the hide-timeout below was
    // never stored anywhere, so nothing could ever cancel it: moving the
    // mouse from the Like button toward the picker (crossing the small
    // gap between them) started an uncancelable countdown to close, so
    // the picker could vanish before the pointer even reached it.
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setShowReactions(true), 500);
  }, []);

  const onReactionLeave = useCallback(() => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setShowReactions(false), 400);
  }, []);

  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);

  const visibilityIcon =
    post.visibility === 'PUBLIC' ? <Globe size={11} /> :
    post.visibility === 'FRIENDS' ? <Users size={11} /> :
    <Lock size={11} />;

  return (
    // No `layout` prop — causes catastrophic re-measurement across all siblings in a virtual list
    <article className="bg-white dark:bg-surface-dark-2 rounded-xl shadow-card dark:shadow-card-dark overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between p-4">
        <Link to={`/profile/${post.author.username}`} className="flex items-center gap-3 group">
          <Avatar
            src={post.author.avatar}
            name={post.author.fullName}
            size="md"
            isOnline={post.author.isOnline}
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:underline">
                {post.author.fullName}
              </span>
              {post.author.isVerified && (
                <span className="text-brand-500 text-xs" title="Verified">✓</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <span>{timeAgo(post.createdAt)}</span>
              {post.isEdited && <span>(edited)</span>}
              <span aria-hidden>·</span>
              {visibilityIcon}
              {post.feeling && <><span aria-hidden>·</span><span>Feeling {post.feeling}</span></>}
              {post.location && (
                <><span aria-hidden>·</span><MapPin size={10} /><span>{post.location}</span></>
              )}
            </div>
          </div>
        </Link>

        {/* Menu */}
        <div className="relative">
          <button
            aria-label="Post options"
            onClick={() => setShowMenu((v) => !v)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark-3 text-gray-500"
          >
            <MoreHorizontal size={18} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 mt-1 w-52 bg-white dark:bg-surface-dark-2 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-20 overflow-hidden"
              >
                <button
                  onClick={handleToggleSave}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 text-sm text-left text-gray-700 dark:text-gray-200"
                >
                  <Bookmark size={15} className={cn(post.isSaved && 'fill-current text-brand-500')} />
                  {post.isSaved ? 'Remove from Saved' : 'Save post'}
                </button>
                {isOwner && (
                  <>
                    <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-dark-3 text-sm text-left text-gray-700 dark:text-gray-200">
                      <Edit2 size={15} /> Edit post
                    </button>
                    {confirmDelete ? (
                      <div className="px-4 py-3 space-y-2">
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle size={12} /> Delete permanently?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleDelete}
                            disabled={deleting}
                            className="flex-1 text-xs font-semibold py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50"
                          >
                            {deleting ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="flex-1 text-xs py-1.5 bg-gray-100 dark:bg-surface-dark-3 rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-left text-red-500"
                      >
                        <Trash2 size={15} /> Delete post
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {post.content && (
        <div className="px-4 pb-3">
          <p
            className={cn(
              'text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words',
              post.content.length < 100 ? 'text-xl font-medium leading-snug' : 'text-sm leading-relaxed'
            )}
          >
            {post.content}
          </p>
        </div>
      )}

      {/* ── Media grid ─────────────────────────────────────────────────── */}
      {post.media && post.media.length > 0 && (
        <div
          className={cn(
            'grid gap-0.5',
            post.media.length === 1 && 'grid-cols-1',
            post.media.length === 2 && 'grid-cols-2',
            post.media.length >= 3 && 'grid-cols-2'
          )}
        >
          {post.media.slice(0, 4).map((media, i) => (
            <div
              key={`${media.url}-${i}`}
              className={cn(
                'relative overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer',
                post.media!.length === 1 ? 'max-h-[520px]' : 'h-52',
                post.media!.length === 3 && i === 0 ? 'col-span-2' : ''
              )}
            >
              {media.type === 'VIDEO' ? (
                <video
                  src={media.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={media.url}
                  alt={`${post.author.fullName}'s post image ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover hover:opacity-95 transition-opacity"
                />
              )}
              {i === 3 && post.media!.length > 4 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                  <span className="text-white text-2xl font-bold">+{post.media!.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      {(totalReactions > 0 || (post.commentsCount ?? 0) > 0 || (post.sharesCount ?? 0) > 0) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            {post.reactionSummary?.slice(0, 3).map((r) => (
              <span key={r.type} className="text-sm leading-none">{REACTION_EMOJIS[r.type]}</span>
            ))}
            {totalReactions > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 tabular-nums">
                {totalReactions.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {(post.commentsCount ?? 0) > 0 && (
              <button
                onClick={() => setShowComments((v) => !v)}
                className="hover:underline"
              >
                {post.commentsCount} comment{post.commentsCount !== 1 ? 's' : ''}
              </button>
            )}
            {(post.sharesCount ?? 0) > 0 && (
              <span>{post.sharesCount} shares</span>
            )}
          </div>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center px-2 py-1 border-b border-gray-100 dark:border-gray-700">
        {/* Like / reaction */}
        <div className="relative flex-1">
          <button
            onClick={() => handleReact(myReaction ?? 'LIKE')}
            onMouseEnter={onReactionEnter}
            onMouseLeave={onReactionLeave}
            disabled={reacting}
            aria-label={myReaction ? `Remove ${myReaction} reaction` : 'Like'}
            className={cn(
              'flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60',
              myReaction
                ? 'text-brand-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3'
            )}
          >
            {myReaction ? (
              <span className="text-base leading-none">{REACTION_EMOJIS[myReaction]}</span>
            ) : (
              <ThumbsUp size={17} />
            )}
            <span style={myReaction ? { color: REACTION_COLORS[myReaction] } : {}}>
              {myReaction
                ? myReaction.charAt(0) + myReaction.slice(1).toLowerCase()
                : 'Like'}
            </span>
          </button>

          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.92 }}
                transition={{ duration: 0.15 }}
                onMouseEnter={() => { if (reactionTimer.current) clearTimeout(reactionTimer.current); }}
                onMouseLeave={onReactionLeave}
                role="dialog"
                aria-label="Reaction picker"
                className="absolute bottom-full left-0 mb-2 bg-white dark:bg-surface-dark-2 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-1 z-30"
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleReact(r)}
                    aria-label={r}
                    className="text-2xl hover:scale-125 active:scale-110 transition-transform duration-100 p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full"
                  >
                    {REACTION_EMOJIS[r]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
        >
          <MessageCircle size={17} />
          <span>Comment</span>
        </button>

        <button className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors">
          <Share2 size={17} />
          <span>Share</span>
        </button>
      </div>

      {/* ── Comment section ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CommentSection postId={post.id} initialComments={post.comments ?? []} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
});

export { PostCard };
