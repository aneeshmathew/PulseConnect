import { GraphQLError } from 'graphql';
import { Video } from '../../models/Video';
import { GraphQLContext, requireAuth } from '../context';
import { validate, CreateVideoSchema, VideoCommentSchema } from '../../lib/validation';

// Same base64(ISO date) cursor pattern as post.resolvers.ts's feed/userPosts
// — kept identical so pagination behaves consistently across every
// connection type in the app rather than introducing a second convention.
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

async function paginateVideos(query: any, cursor: string | undefined, safeLimit: number) {
  if (cursor) query.createdAt = { $lt: decodeCursor(cursor) };

  // Videos whose author has since been deleted are filtered out below via
  // populate's `match` + a null-check. Fetching exactly `safeLimit + 1` and
  // filtering afterward means a deleted-author video occupying one of
  // those slots silently shrinks the valid count below what's actually
  // available further back — `hasMore` then reports `false` and the feed
  // truncates even though more valid videos genuinely exist past the raw
  // fetch window. Loop, widening the fetch, until there are enough valid
  // videos to answer `hasMore` correctly or there's truly nothing left to
  // fetch. Capped at 5 attempts (fetch size doubles each time) so a
  // pathological run of deleted accounts can't turn one page load into an
  // unbounded number of queries.
  const needed = safeLimit + 1;
  let fetchSize = needed;
  let valid: any[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const videos = await Video.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchSize)
      .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
      .lean();

    valid = (videos as any[]).filter((v: any) => v.author != null);
    const exhausted = videos.length < fetchSize; // fewer docs than asked for — nothing more exists
    if (valid.length >= needed || exhausted) break;
    fetchSize *= 2;
  }

  const hasMore = valid.length > safeLimit;
  const items = hasMore ? valid.slice(0, safeLimit) : valid;
  return {
    videos: items,
    hasMore,
    nextCursor: hasMore ? encodeCursor(items[items.length - 1].createdAt) : null,
  };
}

export const videoResolvers = {
  Query: {
    // Public feed, same visibility model as exploreFeed — Watch is meant to
    // surface content broadly (like a Reels/Shorts feed), not just
    // friends-of-friends, so it doesn't do the friend-graph blending that
    // the main `feed` query does.
    watchFeed: async (_: unknown, { cursor, limit = 10 }: any) => {
      const safeLimit = Math.min(Math.max(1, limit), 30);
      return paginateVideos({ visibility: 'PUBLIC' }, cursor, safeLimit);
    },

    video: async (_: unknown, { id }: { id: string }) => {
      const video = await Video.findById(id)
        .populate({ path: 'author', select: '-password', match: { _id: { $exists: true } } })
        .populate({ path: 'comments.author', select: '-password' })
        .lean();
      if (!video || !(video as any).author) return null;
      return video;
    },

    userVideos: async (_: unknown, { userId, cursor, limit = 12 }: any, { user }: GraphQLContext) => {
      const safeLimit = Math.min(Math.max(1, limit), 30);
      const isOwner = user?._id.toString() === userId;
      const isFriend = user?.friends.some((id: any) => id.toString() === userId);
      const query: any = { author: userId };
      if (!isOwner) query.visibility = isFriend ? { $in: ['PUBLIC', 'FRIENDS'] } : 'PUBLIC';
      return paginateVideos(query, cursor, safeLimit);
    },
  },

  Mutation: {
    createVideo: async (_: unknown, { input }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const data = validate(CreateVideoSchema, input);
      const video = new Video({ ...data, author: user._id });
      await video.save();
      await video.populate('author', '-password');
      return video;
    },

    deleteVideo: async (_: unknown, { id }: { id: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const video = await Video.findById(id);
      if (!video) throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
      if (video.author.toString() !== user._id.toString()) {
        throw new GraphQLError('Not authorized', { extensions: { code: 'FORBIDDEN' } });
      }
      await video.deleteOne();
      return true;
    },

    reactToVideo: async (_: unknown, { videoId, type }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      const reactionType = type.toUpperCase();
      const video = await Video.findById(videoId);
      if (!video) throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });

      const existingIdx = video.reactions.findIndex((r) => r.user.toString() === user._id.toString());
      if (existingIdx === -1) {
        video.reactions.push({ user: user._id, type: reactionType, createdAt: new Date() } as any);
      } else {
        video.reactions[existingIdx].type = reactionType;
      }
      await video.save();
      await video.populate('author', '-password');
      return video;
    },

    removeVideoReaction: async (_: unknown, { videoId }: { videoId: string }, { user }: GraphQLContext) => {
      requireAuth(user);
      const video = await Video.findByIdAndUpdate(
        videoId,
        { $pull: { reactions: { user: user._id } } },
        { new: true }
      ).populate('author', '-password');
      if (!video) throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
      return video;
    },

    commentOnVideo: async (_: unknown, { videoId, content }: any, { user }: GraphQLContext) => {
      requireAuth(user);
      validate(VideoCommentSchema, { videoId, content });
      const video = await Video.findByIdAndUpdate(
        videoId,
        { $push: { comments: { author: user._id, content: content.trim(), createdAt: new Date() } } },
        { new: true }
      ).populate('author', '-password');
      if (!video) throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
      await video.populate('comments.author', '-password');
      return video;
    },

    // Fire-and-forget view counter — separate from the main `video(id)`
    // query (which does NOT increment on every read, unlike Post's
    // `post(id)`) because Watch is a swipeable feed: the same video can
    // scroll in/out of view many times without a fresh query each time.
    // The frontend calls this once per genuine view (e.g. after a couple
    // seconds of playback), not on every render.
    incrementVideoView: async (_: unknown, { videoId }: { videoId: string }) => {
      await Video.findByIdAndUpdate(videoId, { $inc: { viewCount: 1 } });
      return true;
    },
  },

  Video: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
    visibility: (parent: any) => (parent.visibility ?? 'PUBLIC').toUpperCase(),

    reactionsCount: (parent: any) => parent.reactions?.length ?? 0,
    commentsCount: (parent: any) => parent.comments?.length ?? 0,
    sharesCount: (parent: any) => parent.shares?.length ?? 0,

    myReaction: (parent: any, _: unknown, { user }: GraphQLContext) => {
      if (!user) return null;
      const r = parent.reactions?.find((r: any) => r.user.toString() === user._id.toString());
      return r ? r.type.toUpperCase() : null;
    },

    reactionSummary: (parent: any) => {
      const summary: Record<string, number> = {};
      (parent.reactions ?? []).forEach((r: any) => {
        const t = r.type.toUpperCase();
        summary[t] = (summary[t] ?? 0) + 1;
      });
      return Object.entries(summary).map(([type, count]) => ({ type, count }));
    },

    // `comments.author` is only populated by the single `video(id)` query
    // and by createVideo/reactToVideo/commentOnVideo's own `.populate()`
    // calls above — watchFeed/userVideos leave each comment's author as a
    // raw ObjectId (populating a nested array on every feed page would be
    // wasteful when captions/reaction counts are the primary content).
    // Resolve here via the shared userLoader so it's correct regardless of
    // which query returned the video — same pattern as Post.tags.
    comments: async (parent: any, _: unknown, { loaders }: GraphQLContext) => {
      const list = parent.comments ?? [];
      if (!list.length) return [];

      // ✅ Fix: this used to `{ ...c, author: authors[i] }` — spreading a
      // Mongoose subdocument. reactToVideo/removeVideoReaction return a
      // live (non-.lean()) document, since they need .save()/$pull, and
      // object-spreading a Mongoose subdocument does NOT reliably carry
      // over `_id` as an own enumerable property. That silently dropped
      // `_id`, and VideoComment.id (which reads parent._id ?? parent.id)
      // had nothing to resolve — "Cannot return null for non-nullable
      // field VideoComment.id". Building the shape field-by-field instead
      // of spreading works identically for lean plain objects and live
      // Mongoose subdocuments, since direct property access (c._id,
      // c.content, ...) is reliable on both.
      const alreadyPopulated = list[0]?.author && typeof list[0].author === 'object' && 'firstName' in list[0].author;
      const authors = alreadyPopulated
        ? list.map((c: any) => c.author)
        : await loaders.userLoader.loadMany(list.map((c: any) => c.author.toString()));

      return list.map((c: any, i: number) => ({
        id: c._id?.toString() ?? c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: authors[i],
      }));
    },
  },

  VideoComment: {
    id: (parent: any) => parent._id?.toString() ?? parent.id,
  },
};
