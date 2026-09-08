import { useState, useCallback, memo } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Send, Smile, CornerDownRight, Loader2 } from 'lucide-react';
import { CREATE_COMMENT, GET_POST_COMMENTS } from '@/lib/graphql';
import { Avatar } from '@/components/UI/Avatar';
import { useAuthStore } from '@/store';
import { timeAgo, cn } from '@/utils';
import toast from 'react-hot-toast';

// Small curated set rather than a full picker library (none is installed,
// and pulling one in for a comment box is a heavier dependency than this
// needs) — enough to cover the common reactions people actually reach for.
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🎉', '😮', '😢', '🔥', '🙌', '😍', '🤔', '👏'];

interface CommentProps {
  comment: any;
  postId: string;
  depth?: number;
}

const Comment = memo(function Comment({ comment, postId, depth = 0 }: CommentProps) {
  const { user } = useAuthStore();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(false);

  const [createComment, { loading }] = useMutation(CREATE_COMMENT, {
    // ✅ Fix: this was a no-op `update()` with no `refetchQueries` at all —
    // a posted reply had nowhere to go: not written into any cache the UI
    // reads from, and nothing re-fetched to pick it up either. Refetching
    // GET_POST_COMMENTS (scoped to this exact postId) picks up both the
    // new reply and its parent's updated repliesCount.
    refetchQueries: [{ query: GET_POST_COMMENTS, variables: { postId, limit: 10 } }],
  });

  const handleReply = useCallback(async () => {
    const content = replyText.trim();
    if (!content || loading) return;
    try {
      await createComment({
        variables: { input: { postId, content, parentCommentId: comment.id } },
      });
      setReplyText('');
      setShowReply(false);
      setShowReplies(true);
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to reply');
    }
  }, [replyText, loading, createComment, postId, comment.id]);

  return (
    <div className={cn('flex gap-2', depth > 0 && 'ml-10 mt-2')}>
      <Avatar src={comment.author.avatar} name={comment.author.fullName} size="sm" />
      <div className="flex-1 min-w-0">
        {/* Bubble */}
        <div className="bg-gray-100 dark:bg-surface-dark-3 rounded-2xl px-3 py-2 inline-block max-w-full">
          <span className="font-semibold text-xs text-gray-900 dark:text-white">{comment.author.fullName}</span>
          {comment.isEdited && <span className="text-[10px] text-gray-400 ml-1">(edited)</span>}
          <p className="text-sm text-gray-800 dark:text-gray-200 break-words mt-0.5">{comment.content}</p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-1 ml-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{timeAgo(comment.createdAt)}</span>
          <button className="font-semibold hover:text-brand-500 transition-colors">Like</button>
          {depth === 0 && (
            <button
              onClick={() => setShowReply((v) => !v)}
              className="font-semibold hover:text-brand-500 transition-colors flex items-center gap-0.5"
            >
              <CornerDownRight size={11} /> Reply
            </button>
          )}
          {comment.repliesCount > 0 && depth === 0 && (
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="font-semibold hover:text-brand-500 transition-colors"
            >
              {showReplies ? 'Hide replies' : `${comment.repliesCount} repl${comment.repliesCount === 1 ? 'y' : 'ies'}`}
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReply && user && (
          <div className="flex items-center gap-2 mt-2">
            <Avatar src={user.avatar} name={user.fullName} size="xs" />
            <div className="flex-1 flex items-center bg-gray-100 dark:bg-surface-dark-3 rounded-full px-3 py-1.5 gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                placeholder={`Reply to ${comment.author.firstName}…`}
                maxLength={8000}
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || loading}
                className="text-brand-500 disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Nested replies — fetched inline via GET_POST_COMMENTS's
            `replies(limit: 5)` selection (see graphql.ts), not a separate
            query; comment.replies was previously never requested at all,
            so this list was always empty regardless of showReplies. */}
        {showReplies && comment.replies?.map((reply: any) => (
          <Comment key={reply.id} comment={reply} postId={postId} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
});

interface CommentSectionProps {
  postId: string;
}

export function CommentSection({ postId }: CommentSectionProps) {
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  // ✅ Fix: this component previously only rendered whatever `initialComments`
  // prop it was handed — and every caller (PostCard, fed by GetFeed /
  // GetUserPosts / GetSavedPosts) only ever had `post.commentsCount`
  // available, never the actual comment list (see the note by
  // GET_POST_COMMENTS in graphql.ts). So `initialComments` was silently `[]`
  // everywhere except a page using GET_POST directly — this component is
  // only mounted once someone actually expands a post's comments (see
  // PostCard.tsx's `showComments` toggle), which is exactly the right
  // moment to fetch its own data instead of depending on a prop no caller
  // could actually supply.
  const { data, loading: loadingComments } = useQuery(GET_POST_COMMENTS, {
    variables: { postId, limit: 10 },
  });
  const comments: any[] = data?.comments ?? [];

  const [createComment, { loading }] = useMutation(CREATE_COMMENT, {
    // ✅ Fix: `refetchQueries: ['GetPost']` refetches active queries BY
    // OPERATION NAME — but "GetPost" is only active on the standalone
    // post-detail route. From the main feed (GetFeed) or a profile
    // (GetUserPosts), no query named "GetPost" is running at all, so this
    // silently matched nothing (Apollo logs "Unknown query named 'GetPost'
    // requested in refetchQueries options.include array" — the console
    // errors reported alongside this bug) and the newly-created comment
    // had no query to refresh. Targeting GET_POST_COMMENTS by document +
    // this exact postId works regardless of which page the comment was
    // posted from.
    refetchQueries: [{ query: GET_POST_COMMENTS, variables: { postId, limit: 10 } }],
  });

  const handleSubmit = useCallback(async () => {
    const content = text.trim();
    if (!content || !user || loading) return;
    try {
      await createComment({ variables: { input: { postId, content } } });
      setText('');
    } catch (err: any) {
      toast.error(err?.graphQLErrors?.[0]?.message ?? 'Failed to post comment');
    }
  }, [text, user, loading, createComment, postId]);

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Composer */}
      {user && (
        <div className="flex items-center gap-2">
          <Avatar src={user.avatar} name={user.fullName} size="sm" />
          <div className="relative flex-1 flex items-center bg-gray-100 dark:bg-surface-dark-3 rounded-full px-4 py-2 gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Write a comment…"
              maxLength={8000}
              className="flex-1 bg-transparent text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
            />
            <button
              onClick={() => setShowEmoji((v) => !v)}
              aria-label="Add emoji"
              aria-expanded={showEmoji}
              className={cn('transition-colors', showEmoji ? 'text-brand-500' : 'text-gray-400 hover:text-brand-500')}
            >
              <Smile size={15} />
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || loading}
              className="text-brand-500 disabled:opacity-40 transition-opacity"
              aria-label="Post comment"
            >
              <Send size={15} />
            </button>

            {showEmoji && (
              <div
                role="menu"
                aria-label="Choose an emoji"
                className="absolute bottom-full right-0 mb-2 w-56 p-2 grid grid-cols-6 gap-1 bg-white dark:bg-surface-dark-2 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 z-10"
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { setText((t) => t + emoji); setShowEmoji(false); }}
                    className="text-xl leading-none py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-surface-dark-3 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-3">
        {loadingComments && comments.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <Loader2 size={14} className="animate-spin" /> Loading comments…
          </div>
        )}
        {!loadingComments && comments.length === 0 && (
          <p className="text-sm text-gray-400 py-1">No comments yet. Be the first to comment.</p>
        )}
        {comments.map((c) => (
          <Comment key={c.id} comment={c} postId={postId} />
        ))}
      </div>
    </div>
  );
}


