import { Post } from '../../models/Post';
import { User } from '../../models/User';
import { Comment } from '../../models/Comment';
import { Notification } from '../../models/Notification';
import { GraphQLContext, requireAuth, EVENTS } from '../context';
import { GraphQLError } from 'graphql';
import { validate, CreatePostSchema } from '../../lib/validation';

function decodeCursor(cursor: string): Date {
  try {
    return new Date(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new GraphQLError('Invalid pagination cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

function encodeCursor(date: Date): string {
  return Buffer.from(date.toISOString(), 'utf8').toString('base64url');
}

/**
 * Smart feed:
 * 1. Fetch friend/own posts (social graph)
 * 2. Always pad with public posts to fill the page — so new users always see content
 */
async function buildFeed(userId: any, friendIds: any[], cursor: string | undefined, safeLimit: number) {
  const authorIds = [userId, ...friendIds];
  const cursorFilter = cursor ? { createdAt: { $lt: decodeCursor(cursor) } } : {};

  // Primary: own + friends posts
  const primaryPosts = await Post.find({
    author: { $in: authorIds },
    visibility: { $in: ['PUBLIC', 'FRIENDS'] },
    ...cursorFilter,
  })
    .sort({ createdAt: -1 })
    .limit(safeLimit + 1)
    .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
    .lean();

  // Filter out posts whose author document was deleted (stale references)
  const validPrimary = primaryPosts.filter((p: any) => p.author != null);

  const hasFriendPostsForNextPage = validPrimary.length > safeLimit;
  const primaryItems = hasFriendPostsForNextPage ? validPrimary.slice(0, safeLimit) : validPrimary;

  // Always backfill with public posts from other users to fill the page
  const seenIds = new Set(primaryItems.map((p: any) => p._id.toString()));
  const needed = safeLimit + 1 - primaryItems.length;

  const publicPosts = needed > 0
    ? await Post.find({
        _id: { $nin: Array.from(seenIds) },
        author: { $nin: authorIds },
        visibility: 'PUBLIC',
        ...cursorFilter,
      })
        .sort({ createdAt: -1 })
        .limit(needed)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean()
    : [];

  // Filter stale refs from public posts too
  const validPublic = (publicPosts as any[]).filter((p: any) => p.author != null);

  const merged = [...primaryItems, ...validPublic];
  merged.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const hasMore = merged.length > safeLimit || hasFriendPostsForNextPage;
  const items = merged.length > safeLimit ? merged.slice(0, safeLimit) : merged;
  const nextCursor = items.length > 0 ? encodeCursor(items[items.length - 1].createdAt) : null;

  return { posts: items, hasMore, nextCursor };
}

export const postResolvers = {
  Query: {
    feed: async (_: unknown, { cursor, limit = 15 }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const result = await buildFeed(user._id, user.friends ?? [], cursor, safeLimit);
      return { ...result, total: -1 };
    },

    exploreFeed: async (_: unknown, { cursor, limit = 15 }: any) => {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const query: any = { visibility: 'PUBLIC' };
      if (cursor) query.createdAt = { $lt: decodeCursor(cursor) };

      const posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .limit(safeLimit + 1)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();

      const valid = (posts as any[]).filter((p: any) => p.author != null);
      const hasMore = valid.length > safeLimit;
      const items = hasMore ? valid.slice(0, safeLimit) : valid;
      return { posts: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1].createdAt) : null, total: -1 };
    },

    post: async (_: unknown, { id }: { id: string }) => {
      const post = await Post.findById(id)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .populate('tags', 'id username firstName lastName avatar isOnline isVerified')
        .populate({ path: 'sharedFrom', populate: { path: 'author', select: '-password' } })
        .lean();
      if (!post || !post.author) return null;
      Post.findByIdAndUpdate(id, { $inc: { viewCount: 1 } }).exec();
      return post;
    },

    userPosts: async (_: unknown, { userId, cursor, limit = 15 }: any, { user }: GraphQLContext) => {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const isOwner = user?._id.toString() === userId;
      const isFriend = user?.friends.some((id: any) => id.toString() === userId);

      const query: any = { author: userId };
      if (!isOwner) query.visibility = isFriend ? { $in: ['PUBLIC', 'FRIENDS'] } : 'PUBLIC';
      if (cursor) query.createdAt = { $lt: decodeCursor(cursor) };

      const posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .limit(safeLimit + 1)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();

      const valid = (posts as any[]).filter((p: any) => p.author != null);
      const hasMore = valid.length > safeLimit;
      const items = hasMore ? valid.slice(0, safeLimit) : valid;
      return { posts: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1].createdAt) : null, total: -1 };
    },

    // Backs the Profile page's Photos tab. Previously that tab was a
    // hardcoded placeholder ("Photos from posts will appear here.") with no
    // query behind it at all — this is the actual missing piece, not a
    // frontend rendering bug. Filtering `media` at the query level (rather
    // than fetching userPosts and filtering client-side) keeps pagination
    // correct: a page of "posts with photos" isn't skewed by text-only
    // posts silently consuming slots in the limit.
    userPhotos: async (_: unknown, { userId, cursor, limit = 15 }: any, { user }: GraphQLContext) => {
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const isOwner = user?._id.toString() === userId;
      const isFriend = user?.friends.some((id: any) => id.toString() === userId);

      const query: any = { author: userId, 'media.0': { $exists: true } };
      if (!isOwner) query.visibility = isFriend ? { $in: ['PUBLIC', 'FRIENDS'] } : 'PUBLIC';
      if (cursor) query.createdAt = { $lt: decodeCursor(cursor) };

      const posts = await Post.find(query)
        .sort({ createdAt: -1 })
        .limit(safeLimit + 1)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();

      const valid = (posts as any[]).filter((p: any) => p.author != null);
      const hasMore = valid.length > safeLimit;
      const items = hasMore ? valid.slice(0, safeLimit) : valid;
      return { posts: items, hasMore, nextCursor: hasMore ? encodeCursor(items[items.length - 1].createdAt) : null, total: -1 };
    },

    // Backs the Saved page. Unlike feed/userPosts/userPhotos, there's no
    // per-item timestamp to cursor on (savedPosts is just an array of ids,
    // not subdocuments — see the comment on the schema field for why),
    // so this uses a simple offset encoded as the cursor instead of a
    // date. $addToSet appends, so the array's natural order is
    // oldest-saved-first; reversed here for most-recently-saved-first.
    savedPosts: async (_: unknown, { cursor, limit = 15 }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const safeLimit = Math.min(Math.max(1, limit), 50);
      const offset = cursor ? parseInt(Buffer.from(cursor, 'base64url').toString('utf8'), 10) || 0 : 0;

      const fresh = await User.findById(user._id).select('savedPosts').lean();
      const allIds = [...(fresh?.savedPosts ?? [])].reverse();
      const pageIds = allIds.slice(offset, offset + safeLimit + 1);
      const hasMore = pageIds.length > safeLimit;
      const idsToFetch = hasMore ? pageIds.slice(0, safeLimit) : pageIds;

      if (idsToFetch.length === 0) {
        return { posts: [], hasMore: false, nextCursor: null, total: -1 };
      }

      const posts = await Post.find({ _id: { $in: idsToFetch } })
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean();

      // $in doesn't preserve array order — re-sort to match savedPosts order,
      // and drop any posts whose author no longer exists (deleted account).
      const byId = new Map((posts as any[]).map((p: any) => [p._id.toString(), p]));
      const ordered = idsToFetch
        .map((id: any) => byId.get(id.toString()))
        .filter((p: any) => p && p.author != null);

      const nextCursor = hasMore
        ? Buffer.from(String(offset + safeLimit), 'utf8').toString('base64url')
        : null;
      return { posts: ordered, hasMore, nextCursor, total: -1 };
    },
  },

  Mutation: {
    createPost: async (_: unknown, { input }: { input: unknown }, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const data = validate(CreatePostSchema, input);

      if (!data.content?.trim() && !(data.media?.length)) {
        throw new GraphQLError('Post must have content or media', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const post = new Post({
        author: user._id,
        content: data.content?.trim() ?? '',
        // Mongoose model's set:toUpper will uppercase these automatically
        media: (data.media ?? []).map((m: any) => ({ ...m, type: m.type.toUpperCase() })),
        visibility: (data.visibility ?? 'PUBLIC').toUpperCase(),
        tags: data.tags ?? [],
        location: data.location,
        feeling: data.feeling,
      });
      await post.save();
      await post.populate('author', '-password');

      pubsub.publish(EVENTS.NEW_POST, { newPost: post.toObject() });
      return post;
    },

    updatePost: async (_: unknown, { id, content }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      if (!content?.trim()) throw new GraphQLError('Content cannot be empty', { extensions: { code: 'BAD_USER_INPUT' } });

      const post = await Post.findById(id);
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
      if (post.author.toString() !== user._id.toString()) throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });

      post.editHistory.push({ content: post.content, editedAt: new Date() });
      post.content = content.trim();
      post.isEdited = true;
      await post.save();
      await post.populate('author', '-password');

      pubsub.publish(EVENTS.POST_UPDATED, { postUpdated: post.toObject() });
      return post;
    },

    deletePost: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const post = await Post.findById(id);
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
      if (post.author.toString() !== user._id.toString()) throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      await Promise.all([Post.findByIdAndDelete(id), Comment.deleteMany({ post: id })]);
      return true;
    },

    reactToPost: async (_: unknown, { postId, type }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const reactionType = type.toUpperCase();

      const post = await Post.findById(postId).populate('author', '_id firstName lastName');
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });

      const existingIdx = post.reactions.findIndex((r) => r.user.toString() === user._id.toString());
      const isNew = existingIdx === -1;

      if (isNew) {
        post.reactions.push({ user: user._id, type: reactionType as any, createdAt: new Date() });
      } else {
        post.reactions[existingIdx].type = reactionType as any;
      }
      await post.save();

      if (isNew && (post.author as any)._id.toString() !== user._id.toString()) {
        Notification.create({
          recipient: (post.author as any)._id,
          sender: user._id,
          type: 'POST_LIKE',
          entityId: post._id,
          entityType: 'post',
          message: `${user.firstName} ${user.lastName} reacted to your post`,
        }).catch(console.error);
      }

      await post.populate('author', '-password');
      pubsub.publish(EVENTS.POST_UPDATED, { postUpdated: post.toObject() });
      return post;
    },

    removeReaction: async (_: unknown, { postId }: { postId: string }, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const post = await Post.findByIdAndUpdate(
        postId, { $pull: { reactions: { user: user._id } } }, { new: true }
      ).populate('author', '-password');
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
      pubsub.publish(EVENTS.POST_UPDATED, { postUpdated: post.toObject() });
      return post;
    },

    sharePost: async (_: unknown, { postId, content }: any, { user, pubsub }: GraphQLContext) => {
      requireAuth(user);
      const original = await Post.findById(postId);
      if (!original) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
      if (original.visibility === 'PRIVATE') throw new GraphQLError('Cannot share a private post', { extensions: { code: 'FORBIDDEN' } });

      const sharedPost = new Post({ author: user._id, content: content?.trim() ?? '', sharedFrom: postId, visibility: 'PUBLIC' });
      await sharedPost.save();
      Post.findByIdAndUpdate(postId, { $addToSet: { shares: user._id } }).exec();
      await sharedPost.populate('author', '-password');
      pubsub.publish(EVENTS.NEW_POST, { newPost: sharedPost.toObject() });
      return sharedPost;
    },

    pinPost: async (_: unknown, { postId }: { postId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const post = await Post.findById(postId);
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
      if (post.author.toString() !== user._id.toString()) throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      post.isPinned = !post.isPinned;
      await post.save();
      return post;
    },

    savePost: async (_: unknown, { postId }: { postId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const post = await Post.exists({ _id: postId });
      if (!post) throw new GraphQLError('Post not found', { extensions: { code: 'NOT_FOUND' } });
      await User.findByIdAndUpdate(user._id, { $addToSet: { savedPosts: postId } });
      return true;
    },

    unsavePost: async (_: unknown, { postId }: { postId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      await User.findByIdAndUpdate(user._id, { $pull: { savedPosts: postId } });
      return true;
    },
  },

  Post: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,

    // ── Enum normalizers ──────────────────────────────────────────────────────
    // DB may contain lowercase values from old documents. These resolvers
    // uppercase on every read so both old and new data serialize correctly.
    visibility: (parent: any) => (parent.visibility ?? 'PUBLIC').toUpperCase(),

    // ── Computed fields ───────────────────────────────────────────────────────
    commentsCount: async (parent: any, _: unknown, { loaders }: GraphQLContext) =>
      loaders.commentCountLoader.load(parent._id.toString()),

    sharesCount: (parent: any) => parent.shares?.length ?? 0,

    myReaction: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return null;
      const r = parent.reactions?.find((r: any) => r.user.toString() === user._id.toString());
      return r ? r.type.toUpperCase() : null;
    },

    isSaved: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return false;
      const postId = (parent._id ?? parent.id).toString();
      return (user.savedPosts ?? []).some((id: any) => id.toString() === postId);
    },

    reactionSummary: (parent: any) => {
      const summary: Record<string, number> = {};
      (parent.reactions ?? []).forEach((r: any) => {
        const t = r.type.toUpperCase();
        summary[t] = (summary[t] ?? 0) + 1;
      });
      return Object.entries(summary).map(([type, count]) => ({ type, count }));
    },

    comments: async (parent: any, { limit = 3, offset = 0 }: any) =>
      Comment.find({ post: parent._id, parentComment: null })
        .sort({ createdAt: 1 })
        .skip(offset)
        .limit(Math.min(limit, 20))
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .lean(),

    // `parent.tags` is only ever populated by the single `post(id)` query
    // (via `.populate('tags', ...)`) — feed/exploreFeed/userPosts all leave
    // it as raw ObjectIds. Rather than relying on every query author to
    // remember to add `.populate('tags')` (the same mistake that caused the
    // `User.friends` bug), resolve it here via DataLoader so it's correct
    // regardless of which query returned the post. Batch-loads via the
    // shared userLoader, same pattern as User.friends and Reaction.user.
    tags: async (parent: any, _: unknown, { loaders }: GraphQLContext) => {
      if (!parent.tags?.length) return [];
      // Already populated objects (e.g. from the `post(id)` query's
      // `.populate('tags', ...)`) — pass through without a wasted loader call.
      if (typeof parent.tags[0] === 'object' && parent.tags[0]?.firstName) {
        return parent.tags;
      }
      const users = await loaders.userLoader.loadMany(
        parent.tags.map((id: any) => id.toString())
      );
      return users.filter((u: any) => u && !(u instanceof Error));
    },
  },

  // ── Shared type resolvers ─────────────────────────────────────────────────
  // These apply every time a Reaction or Media object is returned anywhere
  // in the schema (Post reactions, Comment reactions, Story reactions, etc.)

  Reaction: {
    // Uppercase for old lowercase DB values
    type: (parent: any) => (parent.type ?? 'LIKE').toUpperCase(),

    // Reactions are NOT populated — user field is a raw ObjectId.
    // Use DataLoader to batch-load the full User document.
    user: async (parent: any, _: unknown, { loaders }: GraphQLContext) => {
      // Already a populated object (e.g. from a mutation response)
      if (parent.user && typeof parent.user === 'object' && parent.user.firstName) {
        return parent.user;
      }
      const userId = parent.user?._id?.toString() ?? parent.user?.toString();
      if (!userId) return null;
      return loaders.userLoader.load(userId);
    },
  },

  Media: {
    // Uppercase for old lowercase DB values ('image' → 'IMAGE')
    type: (parent: any) => (parent.type ?? 'IMAGE').toUpperCase(),
  },
};
