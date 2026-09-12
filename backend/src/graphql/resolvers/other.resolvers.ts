import { Comment } from '../../models/Comment';
import { Post } from '../../models/Post';
import { Notification } from '../../models/Notification';
import { Story } from '../../models/Story';
import { GraphQLContext, requireAuth, EVENTS } from '../context';
import { GraphQLError } from 'graphql';
import { validate, CreateCommentSchema } from '../../lib/validation';

// ─── Comments ────────────────────────────────────────────────────────────────

export const commentResolvers = {
  Query: {
    comments: async (_: unknown, { postId, limit = 10, offset = 0 }: any, { user }: GraphQLContext) => {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const comments = await Comment.find({ post: postId, parentComment: null })
        .sort({ createdAt: 1 })
        .skip(Math.max(0, offset))
        .limit(safeLimit)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();
      return (comments as any[]).filter((c: any) => c.author != null);
    },
  },

  Mutation: {
    createComment: async (_: unknown, { input }: { input: unknown }, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const data = validate(CreateCommentSchema, input);
      const { postId, content, parentCommentId } = data as any;

      // Verify the post exists
      const post = await Post.findById(postId).select('_id author visibility').lean();
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });

      if (parentCommentId) {
        const parent = await Comment.findById(parentCommentId).select('_id post').lean();
        if (!parent || (parent as any).post.toString() !== postId) {
          throw new GraphQLError('Parent comment not found', { extensions: { code: 'NOT_FOUND' } });
        }
      }

      const comment = await Comment.create({
        post: postId,
        author: user._id,
        content: content.trim(),
        parentComment: parentCommentId ?? null,
      });

      // Update parent arrays without blocking the response
      if (parentCommentId) {
        Comment.findByIdAndUpdate(parentCommentId, { $push: { replies: comment._id } }).exec();
      } else {
        Post.findByIdAndUpdate(postId, { $push: { comments: comment._id } }).exec();
      }

      await comment.populate('author', '-password');
      pubsub.publish(EVENTS.NEW_COMMENT, { newComment: comment.toObject() });

      // Notify post author. Awaited (unlike the parent-array $push above,
      // which is fine to leave in-flight since nothing reads it back
      // immediately) — the notification is user-visible and read back
      // right away both by callers/tests and by the recipient's live
      // notification feed, so it needs to actually exist before this
      // resolver returns, matching the same pattern user.resolvers.ts
      // already uses for friend-request notifications.
      if ((post as any).author.toString() !== user._id.toString()) {
        try {
          const notif = await Notification.create({
            recipient: (post as any).author,
            sender: user._id,
            type: parentCommentId ? 'COMMENT_REPLY' : 'POST_COMMENT',
            entityId: postId,
            entityType: 'post',
            message: `${user.firstName} ${user.lastName} ${parentCommentId ? 'replied to a comment' : 'commented on your post'}`,
          });
          pubsub.publish(EVENTS.NEW_NOTIFICATION, { newNotification: notif });
        } catch (err) {
          console.error(err);
        }
      }

      return comment;
    },

    updateComment: async (_: unknown, { id, content }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      if (!content?.trim()) {
        throw new GraphQLError('Content cannot be empty', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const comment = await Comment.findById(id);
      if (!comment) throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
      if (comment.author.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      comment.content = content.trim();
      comment.isEdited = true;
      await comment.save();
      await comment.populate('author', '-password');
      return comment;
    },

    deleteComment: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const comment = await Comment.findById(id);
      if (!comment) throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
      if (comment.author.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }

      await Promise.all([
        Comment.findByIdAndDelete(id),
        // Remove from parent's replies or post's comments
        comment.parentComment
          ? Comment.findByIdAndUpdate(comment.parentComment, { $pull: { replies: id } })
          : Post.findByIdAndUpdate(comment.post, { $pull: { comments: id } }),
        // Recursively delete replies (one level)
        Comment.deleteMany({ parentComment: id }),
      ]);
      return true;
    },

    reactToComment: async (_: unknown, { commentId, type }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const comment = await Comment.findById(commentId);
      if (!comment) throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });

      const existingIdx = comment.reactions.findIndex(
        (r: any) => r.user.toString() === user._id.toString()
      );
      if (existingIdx > -1) {
        comment.reactions[existingIdx].type = type.toLowerCase();
      } else {
        comment.reactions.push({ user: user._id, type: type.toLowerCase() as any, createdAt: new Date() });
      }
      await comment.save();
      await comment.populate('author', '-password');
      return comment;
    },
  },

  Comment: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    repliesCount: (parent: any) => parent.replies?.length ?? 0,

    // Mongoose returns {} for absent nested objects — guard so url: String! never fails
    media: (parent: any) => {
      const m = parent.media;
      if (!m || !m.url) return null;
      return m;
    },

    replies: async (parent: any, { limit = 5, offset = 0 }: any) => {
      return Comment.find({ parentComment: parent._id })
        .sort({ createdAt: 1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(limit, 20))
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();
    },
  },
  // Reaction and Media type resolvers are registered in post.resolvers.ts
  // and applied globally by mergeResolvers — no duplication needed here.
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationResolvers = {
  Query: {
    notifications: async (_: unknown, { limit = 20, offset = 0 }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      return Notification.find({ recipient: user._id })
        .sort({ createdAt: -1 })
        .skip(Math.max(0, offset))
        .limit(Math.min(limit, 50))
        .populate('sender', '-password')
        .lean();
    },

    unreadNotificationsCount: async (_: unknown, __: unknown, { user }: GraphQLContext) => {
      if (!user) return 0;
      return Notification.countDocuments({ recipient: user._id, isRead: false });
    },
  },

  Mutation: {
    markNotificationRead: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const notif = await Notification.findOneAndUpdate(
        { _id: id, recipient: user._id }, // scoped to the user
        { isRead: true },
        { new: true }
      ).populate('sender', '-password');
      if (!notif) throw new GraphQLError('Notification not found', { extensions: { code: 'NOT_FOUND' } });
      return notif;
    },

    markAllNotificationsRead: async (_: unknown, __: unknown, { user }: GraphQLContext) => {
      requireAuth(user);
      await Notification.updateMany({ recipient: user._id, isRead: false }, { isRead: true });
      return true;
    },

    // Used after a friend request is accepted/declined from the
    // notification dropdown — the request has been resolved either way, so
    // the notification should actually disappear from the list rather than
    // just having its buttons swapped for a status label (which only
    // persisted in local component state and reappeared as actionable on
    // the next refetch/reopen, since the underlying notification was never
    // touched).
    deleteNotification: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const result = await Notification.deleteOne({ _id: id, recipient: user._id }); // scoped to the user
      return result.deletedCount > 0;
    },
  },

  Notification: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    // Safety net for any legacy lowercase values still in DB
    type: (parent: any) => (parent.type ?? 'MESSAGE').toUpperCase(),
  },
};

// ─── Stories ─────────────────────────────────────────────────────────────────

export const storyResolvers = {
  Query: {
    stories: async (_: unknown, __: unknown, { user }: GraphQLContext) => {
      requireAuth(user);

      const friendIds = user.friends ?? [];
      const authors = [user._id, ...friendIds];

      const stories = await Story.find({
        author: { $in: authors },
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: -1 })
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();

      const userId = user._id.toString();

      // Group by author — current user's stories first
      const grouped: Map<string, any> = new Map();
      stories.forEach((story: any) => {
        const authorId = story.author._id.toString();
        if (!grouped.has(authorId)) {
          grouped.set(authorId, { user: story.author, stories: [], hasUnviewed: false });
        }
        const group = grouped.get(authorId)!;
        group.stories.push(story);
        const hasViewed = (story.views ?? []).some((v: any) => v.user.toString() === userId);
        if (!hasViewed) group.hasUnviewed = true;
      });

      // Bubble the current user's stories to the top
      const result = Array.from(grouped.values());
      result.sort((a, b) => {
        if (a.user._id.toString() === userId) return -1;
        if (b.user._id.toString() === userId) return 1;
        return 0;
      });

      return result;
    },

    userStories: async (_: unknown, { userId }: { userId: string }, { user }: GraphQLContext) => {
      requireAuth(user); // auth guard was missing before
      return Story.find({ author: userId, isActive: true, expiresAt: { $gt: new Date() } })
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();
    },
  },

  Mutation: {
    createStory: async (_: unknown, { input }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const { mediaUrl, mediaType, text, backgroundColor, expiresInHours = 24 } = input;

      const trimmedText = text?.trim();
      if (!mediaUrl && !trimmedText) {
        throw new GraphQLError('A story needs either a photo/video or some text', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      const safeHours = Math.min(Math.max(1, expiresInHours), 24);
      const expiresAt = new Date(Date.now() + safeHours * 3_600_000);

      const story = await Story.create({
        author: user._id,
        media: mediaUrl ? { url: mediaUrl, type: mediaType.toLowerCase() } : undefined,
        text: trimmedText,
        backgroundColor,
        expiresAt,
      });
      await story.populate('author', '-password');

      pubsub.publish(EVENTS.NEW_STORY, { newStory: story.toObject() });
      return story;
    },

    viewStory: async (_: unknown, { storyId }: { storyId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const story = await Story.findByIdAndUpdate(
        storyId,
        { $addToSet: { views: { user: user._id, viewedAt: new Date() } } },
        { new: true }
      ).populate('author', '-password');
      if (!story) throw new GraphQLError('Story not found', { extensions: { code: 'NOT_FOUND' } });
      return story;
    },

    deleteStory: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const story = await Story.findById(id);
      if (!story) throw new GraphQLError('Story not found', { extensions: { code: 'NOT_FOUND' } });
      if (story.author.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      await Story.findByIdAndDelete(id);
      return true;
    },

    reactToStory: async (_: unknown, { storyId, emoji }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const story = await Story.findByIdAndUpdate(
        storyId,
        { $push: { reactions: { user: user._id, emoji, createdAt: new Date() } } },
        { new: true }
      ).populate('author', '-password');
      if (!story) throw new GraphQLError('Story not found', { extensions: { code: 'NOT_FOUND' } });
      return story;
    },
  },

  Story: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    viewsCount: (parent: any) => parent.views?.length ?? 0,
    hasViewed: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return false;
      return (parent.views ?? []).some(
        (v: any) => v.user.toString() === user._id.toString()
      );
    },
    // StoryMedia.type is String! so no enum issue — keep lowercase. Return
    // explicit fields rather than `{ ...parent.media }`: Mongoose exposes
    // subdocument fields via getters on the prototype, not as the
    // instance's own enumerable properties, so spreading a Mongoose
    // subdocument silently drops every field (url included) — which is
    // exactly what was making StoryMedia.url come back null.
    media: (parent: any) => {
      if (!parent.media || !parent.media.url) return null;
      return {
        url: parent.media.url,
        type: (parent.media.type ?? 'image').toLowerCase(),
        duration: parent.media.duration,
        thumbnail: parent.media.thumbnail,
      };
    },
  },
};
