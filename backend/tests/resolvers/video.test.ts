import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { Video } from '../../src/models/Video';
import { User } from '../../src/models/User';

function createVideo(author: any, overrides: Record<string, any> = {}) {
  return Video.create({
    author: author._id,
    url: overrides.url ?? 'https://example.com/video.mp4',
    caption: overrides.caption ?? 'a video',
    ...overrides,
  });
}

const CREATE_VIDEO = /* GraphQL */ `
  mutation CreateVideo($input: CreateVideoInput!) {
    createVideo(input: $input) {
      id
      url
      caption
      visibility
      author {
        username
      }
    }
  }
`;

describe('createVideo', () => {
  it('creates a video defaulting to PUBLIC visibility', async () => {
    const author = await createUser({ username: 'video_author' });
    const viewer = await asContextUser(author);

    const result = await graphql({
      schema,
      source: CREATE_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { url: 'https://example.com/clip.mp4', caption: 'My first reel' } },
    });

    expect(result.errors).toBeUndefined();
    const video = result.data?.createVideo as any;
    expect(video.visibility).toBe('PUBLIC');
    expect(video.caption).toBe('My first reel');
    expect(video.author.username).toBe('video_author');
  });

  it('rejects an invalid (non-URL) video url', async () => {
    const author = await createUser({ username: 'video_author2' });
    const viewer = await asContextUser(author);

    const result = await graphql({
      schema,
      source: CREATE_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { url: 'not-a-url' } },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

const WATCH_FEED = /* GraphQL */ `
  query WatchFeed($cursor: String, $limit: Int) {
    watchFeed(cursor: $cursor, limit: $limit) {
      videos {
        id
        caption
      }
      hasMore
      nextCursor
    }
  }
`;

describe('watchFeed', () => {
  it('only returns PUBLIC videos, never FRIENDS or PRIVATE ones', async () => {
    const author = await createUser({ username: 'feed_author' });
    await createVideo(author, { caption: 'public one', visibility: 'PUBLIC' });
    await createVideo(author, { caption: 'friends only', visibility: 'FRIENDS' });
    await createVideo(author, { caption: 'private one', visibility: 'PRIVATE' });

    const result = await graphql({ schema, source: WATCH_FEED, contextValue: contextFor(null) });

    expect(result.errors).toBeUndefined();
    const videos = (result.data?.watchFeed as any).videos;
    expect(videos).toHaveLength(1);
    expect(videos[0].caption).toBe('public one');
  });

  it('paginates with hasMore/nextCursor and excludes a video whose author was deleted', async () => {
    // Also regression coverage for a pagination bug found while writing this
    // test: fetching exactly `safeLimit + 1` raw docs and filtering out
    // deleted-author videos afterward could undercount `valid`, so a
    // deleted-author video landing in that window used to make `hasMore`
    // falsely report `false` and silently drop a real video (`video 0`
    // below) that was never even fetched. Fixed in paginateVideos() by
    // widening the fetch in a bounded loop until there are enough valid
    // videos to answer correctly.
    const author = await createUser({ username: 'page_author' });
    const ghost = await createUser({ username: 'page_ghost' });
    for (let i = 0; i < 3; i++) {
      await createVideo(author, { caption: `video ${i}` });
    }
    await createVideo(ghost, { caption: 'orphaned video' });
    await User.findByIdAndDelete(ghost._id);

    const result = await graphql({
      schema,
      source: WATCH_FEED,
      contextValue: contextFor(null),
      variableValues: { limit: 2 },
    });

    expect(result.errors).toBeUndefined();
    const page = result.data?.watchFeed as any;
    // 3 valid + 1 orphaned-and-filtered-out; page size 2 with more available.
    expect(page.videos).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();

    // Confirm the fix is end-to-end correct, not just hasMore flipping to
    // true — the second page must actually reach "video 0", the item that
    // used to be silently dropped entirely.
    const nextPage = await graphql({
      schema,
      source: WATCH_FEED,
      contextValue: contextFor(null),
      variableValues: { limit: 2, cursor: page.nextCursor },
    });
    expect(nextPage.errors).toBeUndefined();
    const secondPageVideos = (nextPage.data?.watchFeed as any).videos;
    expect(secondPageVideos.map((v: any) => v.caption)).toEqual(['video 0']);
    expect((nextPage.data?.watchFeed as any).hasMore).toBe(false);
  });
});

const REACT_TO_VIDEO = /* GraphQL */ `
  mutation ReactVideo($videoId: ID!, $type: ReactionType!) {
    reactToVideo(videoId: $videoId, type: $type) {
      myReaction
      reactionsCount
    }
  }
`;

const REMOVE_VIDEO_REACTION = /* GraphQL */ `
  mutation RemoveReaction($videoId: ID!) {
    removeVideoReaction(videoId: $videoId) {
      myReaction
      reactionsCount
    }
  }
`;

describe('video reactions', () => {
  it('adds then changes a reaction in place, then removes it', async () => {
    const author = await createUser({ username: 'vreact_author' });
    const reactor = await createUser({ username: 'vreact_reactor' });
    const video = await createVideo(author);
    const viewer = await asContextUser(reactor);

    const first = await graphql({
      schema,
      source: REACT_TO_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { videoId: video._id.toString(), type: 'LIKE' },
    });
    expect(first.errors).toBeUndefined();
    expect((first.data?.reactToVideo as any).myReaction).toBe('LIKE');
    expect((first.data?.reactToVideo as any).reactionsCount).toBe(1);

    const changed = await graphql({
      schema,
      source: REACT_TO_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { videoId: video._id.toString(), type: 'WOW' },
    });
    expect((changed.data?.reactToVideo as any).myReaction).toBe('WOW');
    expect((changed.data?.reactToVideo as any).reactionsCount).toBe(1); // still just one reactor

    const removed = await graphql({
      schema,
      source: REMOVE_VIDEO_REACTION,
      contextValue: contextFor(viewer as any),
      variableValues: { videoId: video._id.toString() },
    });
    expect(removed.errors).toBeUndefined();
    expect((removed.data?.removeVideoReaction as any).myReaction).toBeNull();
    expect((removed.data?.removeVideoReaction as any).reactionsCount).toBe(0);
  });
});

const COMMENT_ON_VIDEO = /* GraphQL */ `
  mutation CommentOnVideo($videoId: ID!, $content: String!) {
    commentOnVideo(videoId: $videoId, content: $content) {
      commentsCount
      comments {
        id
        content
        author {
          username
        }
      }
    }
  }
`;

const GET_VIDEO = /* GraphQL */ `
  query GetVideo($id: ID!) {
    video(id: $id) {
      id
      comments {
        id
        content
        author {
          username
        }
      }
    }
  }
`;

describe('Video.comments — the VideoComment.id spread regression', () => {
  // Regression coverage for the fixed bug documented directly in
  // video.resolvers.ts: reactToVideo/removeVideoReaction return a live
  // (non-.lean()) Mongoose document, and building each comment via
  // `{ ...c, author: authors[i] }` silently dropped `_id` when spreading a
  // Mongoose subdocument — VideoComment.id then had nothing to resolve
  // from and threw "Cannot return null for non-nullable field
  // VideoComment.id". The fix builds the shape field-by-field instead.
  // These tests exercise the exact path that broke: commenting via a
  // mutation (live document), not just reading a video back via a lean
  // `.find()`.

  it('commentOnVideo resolves comment id and author on the live (non-lean) document it returns', async () => {
    const author = await createUser({ username: 'vcomment_author' });
    const commenter = await createUser({ username: 'vcomment_commenter' });
    const video = await createVideo(author);
    const viewer = await asContextUser(commenter);

    const result = await graphql({
      schema,
      source: COMMENT_ON_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { videoId: video._id.toString(), content: 'Nice reel!' },
    });

    expect(result.errors).toBeUndefined();
    const payload = result.data?.commentOnVideo as any;
    expect(payload.commentsCount).toBe(1);
    expect(payload.comments).toHaveLength(1);
    expect(payload.comments[0].id).toBeTruthy(); // the exact thing that used to be null
    expect(payload.comments[0].content).toBe('Nice reel!');
    expect(payload.comments[0].author.username).toBe('vcomment_commenter');
  });

  it('resolves the same comments correctly when read back via the lean video(id) query', async () => {
    const author = await createUser({ username: 'vcomment_author2' });
    const commenter = await createUser({ username: 'vcomment_commenter2' });
    const video = await createVideo(author);
    const viewer = await asContextUser(commenter);

    await graphql({
      schema,
      source: COMMENT_ON_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { videoId: video._id.toString(), content: 'From the live path' },
    });

    const result = await graphql({
      schema,
      source: GET_VIDEO,
      contextValue: contextFor(viewer as any),
      variableValues: { id: video._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    const comments = (result.data?.video as any).comments;
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBeTruthy();
    expect(comments[0].author.username).toBe('vcomment_commenter2');
  });

  it('multiple comments from different commenters all resolve independently', async () => {
    const author = await createUser({ username: 'vcomment_author3' });
    const commenterA = await createUser({ username: 'vcomment_a' });
    const commenterB = await createUser({ username: 'vcomment_b' });
    const video = await createVideo(author);

    await graphql({
      schema,
      source: COMMENT_ON_VIDEO,
      contextValue: contextFor((await asContextUser(commenterA)) as any),
      variableValues: { videoId: video._id.toString(), content: 'first' },
    });
    const second = await graphql({
      schema,
      source: COMMENT_ON_VIDEO,
      contextValue: contextFor((await asContextUser(commenterB)) as any),
      variableValues: { videoId: video._id.toString(), content: 'second' },
    });

    expect(second.errors).toBeUndefined();
    const comments = (second.data?.commentOnVideo as any).comments;
    expect(comments).toHaveLength(2);
    const usernames = comments.map((c: any) => c.author.username).sort();
    expect(usernames).toEqual(['vcomment_a', 'vcomment_b']);
    // Each comment id must be distinct — a real regression here (all ids
    // resolving to the same fallback/undefined) would collapse these.
    expect(new Set(comments.map((c: any) => c.id)).size).toBe(2);
  });
});

const DELETE_VIDEO = /* GraphQL */ `
  mutation DeleteVideo($id: ID!) {
    deleteVideo(id: $id)
  }
`;

describe('deleteVideo', () => {
  it('rejects deleting a video that belongs to a different user', async () => {
    const owner = await createUser({ username: 'delvid_owner' });
    const attacker = await createUser({ username: 'delvid_attacker' });
    const video = await createVideo(owner);

    const result = await graphql({
      schema,
      source: DELETE_VIDEO,
      contextValue: contextFor((await asContextUser(attacker)) as any),
      variableValues: { id: video._id.toString() },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect(await Video.findById(video._id)).not.toBeNull();
  });

  it('allows the owner to delete their own video', async () => {
    const owner = await createUser({ username: 'delvid_owner2' });
    const video = await createVideo(owner);

    const result = await graphql({
      schema,
      source: DELETE_VIDEO,
      contextValue: contextFor((await asContextUser(owner)) as any),
      variableValues: { id: video._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteVideo).toBe(true);
    expect(await Video.findById(video._id)).toBeNull();
  });
});

const INCREMENT_VIEW = /* GraphQL */ `
  mutation IncrementView($videoId: ID!) {
    incrementVideoView(videoId: $videoId)
  }
`;

describe('incrementVideoView', () => {
  it('increments the view count without requiring authentication', async () => {
    const author = await createUser({ username: 'view_author' });
    const video = await createVideo(author);

    const result = await graphql({
      schema,
      source: INCREMENT_VIEW,
      contextValue: contextFor(null),
      variableValues: { videoId: video._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    const updated = await Video.findById(video._id);
    expect(updated?.viewCount).toBe(1);
  });
});

describe('userVideos — visibility scoping', () => {
  const USER_VIDEOS = /* GraphQL */ `
    query UserVideos($userId: ID!) {
      userVideos(userId: $userId) {
        videos {
          caption
        }
      }
    }
  `;

  it('shows a friend PUBLIC + FRIENDS videos but not PRIVATE ones', async () => {
    const author = await createUser({ username: 'vis_author' });
    const friend = await createUser({ username: 'vis_friend' });
    const stranger = await createUser({ username: 'vis_stranger' });
    await User.findByIdAndUpdate(author._id, { $set: { friends: [friend._id] } });

    await createVideo(author, { caption: 'public', visibility: 'PUBLIC' });
    await createVideo(author, { caption: 'friends', visibility: 'FRIENDS' });
    await createVideo(author, { caption: 'private', visibility: 'PRIVATE' });

    const asFriend = await graphql({
      schema,
      source: USER_VIDEOS,
      contextValue: contextFor((await asContextUser(friend)) as any),
      variableValues: { userId: author._id.toString() },
    });
    expect(asFriend.errors).toBeUndefined();
    const friendCaptions = (asFriend.data?.userVideos as any).videos.map((v: any) => v.caption).sort();
    expect(friendCaptions).toEqual(['friends', 'public']);

    const asStranger = await graphql({
      schema,
      source: USER_VIDEOS,
      contextValue: contextFor((await asContextUser(stranger)) as any),
      variableValues: { userId: author._id.toString() },
    });
    expect(asStranger.errors).toBeUndefined();
    const strangerCaptions = (asStranger.data?.userVideos as any).videos.map((v: any) => v.caption);
    expect(strangerCaptions).toEqual(['public']);

    const asOwner = await graphql({
      schema,
      source: USER_VIDEOS,
      contextValue: contextFor((await asContextUser(author)) as any),
      variableValues: { userId: author._id.toString() },
    });
    expect(asOwner.errors).toBeUndefined();
    expect((asOwner.data?.userVideos as any).videos).toHaveLength(3);
  });
});
