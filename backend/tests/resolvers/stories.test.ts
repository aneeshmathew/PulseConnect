import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { Story } from '../../src/models/Story';
import { User } from '../../src/models/User';

const CREATE_STORY = /* GraphQL */ `
  mutation CreateStory($input: CreateStoryInput!) {
    createStory(input: $input) {
      id
      text
      media {
        url
        type
      }
    }
  }
`;

const STORIES = /* GraphQL */ `
  query Stories {
    stories {
      user {
        username
      }
      hasUnviewed
      stories {
        id
      }
    }
  }
`;

describe('createStory', () => {
  it('creates a text-only story', async () => {
    const author = await createUser({ username: 'story_author' });
    const viewer = await asContextUser(author);

    const result = await graphql({
      schema,
      source: CREATE_STORY,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { text: 'Having a great day!' } },
    });

    expect(result.errors).toBeUndefined();
    const story = result.data?.createStory as any;
    expect(story.text).toBe('Having a great day!');
    expect(story.media).toBeNull();
  });

  it('creates a media story with the type normalized', async () => {
    const author = await createUser({ username: 'story_author2' });
    const viewer = await asContextUser(author);

    const result = await graphql({
      schema,
      source: CREATE_STORY,
      contextValue: contextFor(viewer as any),
      variableValues: {
        input: { mediaUrl: 'https://example.com/photo.jpg', mediaType: 'IMAGE' },
      },
    });

    expect(result.errors).toBeUndefined();
    const story = result.data?.createStory as any;
    expect(story.media.url).toBe('https://example.com/photo.jpg');
    expect(story.media.type).toBe('image');
  });

  it('rejects a story with neither text nor media', async () => {
    const author = await createUser({ username: 'story_author3' });
    const viewer = await asContextUser(author);

    const result = await graphql({
      schema,
      source: CREATE_STORY,
      contextValue: contextFor(viewer as any),
      variableValues: { input: {} },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
  });
});

describe('stories query', () => {
  it('shows own and friends\' active stories, grouped by author, self first', async () => {
    const me = await createUser({ username: 'stories_me' });
    const friend = await createUser({ username: 'stories_friend' });
    const stranger = await createUser({ username: 'stories_stranger' });

    await User.findByIdAndUpdate(me._id, { $set: { friends: [friend._id] } });

    await Story.create({ author: me._id, text: 'my story', expiresAt: new Date(Date.now() + 3_600_000) });
    await Story.create({ author: friend._id, text: 'friend story', expiresAt: new Date(Date.now() + 3_600_000) });
    // Not a friend — must not appear.
    await Story.create({ author: stranger._id, text: 'stranger story', expiresAt: new Date(Date.now() + 3_600_000) });
    // Expired — must not appear even though authored by a friend.
    await Story.create({ author: friend._id, text: 'old story', expiresAt: new Date(Date.now() - 1000) });

    const viewer = await asContextUser(me);
    const result = await graphql({ schema, source: STORIES, contextValue: contextFor(viewer as any) });

    expect(result.errors).toBeUndefined();
    const groups = result.data?.stories as any[];
    expect(groups).toHaveLength(2);
    expect(groups[0].user.username).toBe('stories_me'); // self bubbled to top
    expect(groups[1].user.username).toBe('stories_friend');
    expect(groups[1].stories).toHaveLength(1); // the expired one excluded
    expect(groups[1].hasUnviewed).toBe(true);
  });

  it('marks a group as not having unviewed stories once all are viewed', async () => {
    const me = await createUser({ username: 'view_me' });
    const friend = await createUser({ username: 'view_friend' });
    await User.findByIdAndUpdate(me._id, { $set: { friends: [friend._id] } });

    const story = await Story.create({
      author: friend._id,
      text: 'view me',
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    await graphql({
      schema,
      source: /* GraphQL */ `
        mutation View($storyId: ID!) {
          viewStory(storyId: $storyId) {
            id
          }
        }
      `,
      contextValue: contextFor((await asContextUser(me)) as any),
      variableValues: { storyId: story._id.toString() },
    });

    const result = await graphql({
      schema,
      source: STORIES,
      contextValue: contextFor((await asContextUser(me)) as any),
    });

    expect(result.errors).toBeUndefined();
    const friendGroup = (result.data?.stories as any[]).find((g: any) => g.user.username === 'view_friend');
    expect(friendGroup.hasUnviewed).toBe(false);
  });
});
