import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, createPost, asContextUser } from '../helpers/factories';
import { Notification } from '../../src/models/Notification';

const REACT_TO_POST = /* GraphQL */ `
  mutation React($postId: ID!, $type: ReactionType!) {
    reactToPost(postId: $postId, type: $type) {
      id
      myReaction
      reactionSummary {
        type
        count
      }
    }
  }
`;

describe('reactToPost', () => {
  it('adds a reaction and notifies the post author exactly once', async () => {
    const author = await createUser({ username: 'react_author' });
    const reactor = await createUser({ username: 'react_reactor' });
    const post = await createPost(author, { content: 'react to me' });

    const viewer = await asContextUser(reactor);
    const result = await graphql({
      schema,
      source: REACT_TO_POST,
      contextValue: contextFor(viewer as any),
      variableValues: { postId: post._id.toString(), type: 'LOVE' },
    });

    expect(result.errors).toBeUndefined();
    const updated = result.data?.reactToPost as any;
    expect(updated.myReaction).toBe('LOVE');
    expect(updated.reactionSummary).toEqual([{ type: 'LOVE', count: 1 }]);

    const notifs = await Notification.find({ recipient: author._id, type: 'POST_LIKE' });
    expect(notifs).toHaveLength(1);
  });

  it('changes an existing reaction in place instead of adding a second one', async () => {
    const author = await createUser({ username: 'react_author2' });
    const reactor = await createUser({ username: 'react_reactor2' });
    const post = await createPost(author);
    const viewer = await asContextUser(reactor);

    await graphql({
      schema,
      source: REACT_TO_POST,
      contextValue: contextFor(viewer as any),
      variableValues: { postId: post._id.toString(), type: 'LIKE' },
    });
    const second = await graphql({
      schema,
      source: REACT_TO_POST,
      contextValue: contextFor(viewer as any),
      variableValues: { postId: post._id.toString(), type: 'ANGRY' },
    });

    expect(second.errors).toBeUndefined();
    const updated = second.data?.reactToPost as any;
    expect(updated.myReaction).toBe('ANGRY');
    // One reactor, changed type — still exactly one total reaction, not two.
    expect(updated.reactionSummary).toEqual([{ type: 'ANGRY', count: 1 }]);

    // Only the first reaction should have notified — a changed reaction
    // isn't a new like.
    const notifs = await Notification.find({ recipient: author._id, type: 'POST_LIKE' });
    expect(notifs).toHaveLength(1);
  });

  it('does not notify the author when they react to their own post', async () => {
    const author = await createUser({ username: 'react_self' });
    const post = await createPost(author);
    const viewer = await asContextUser(author);

    const result = await graphql({
      schema,
      source: REACT_TO_POST,
      contextValue: contextFor(viewer as any),
      variableValues: { postId: post._id.toString(), type: 'HAHA' },
    });

    expect(result.errors).toBeUndefined();
    const notifs = await Notification.find({ recipient: author._id, type: 'POST_LIKE' });
    expect(notifs).toHaveLength(0);
  });
});

const CREATE_COMMENT = /* GraphQL */ `
  mutation CreateComment($input: CreateCommentInput!) {
    createComment(input: $input) {
      id
      content
      author {
        username
      }
    }
  }
`;

const GET_COMMENTS = /* GraphQL */ `
  query GetComments($postId: ID!) {
    comments(postId: $postId) {
      id
      content
      repliesCount
    }
  }
`;

describe('createComment', () => {
  it('creates a top-level comment and notifies the post author', async () => {
    const author = await createUser({ username: 'comment_author' });
    const commenter = await createUser({ username: 'commenter1' });
    const post = await createPost(author);
    const viewer = await asContextUser(commenter);

    const result = await graphql({
      schema,
      source: CREATE_COMMENT,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { postId: post._id.toString(), content: 'Nice post!' } },
    });

    expect(result.errors).toBeUndefined();
    const comment = result.data?.createComment as any;
    expect(comment.content).toBe('Nice post!');
    expect(comment.author.username).toBe('commenter1');

    const notifs = await Notification.find({ recipient: author._id, type: 'POST_COMMENT' });
    expect(notifs).toHaveLength(1);
  });

  it('rejects a comment on a non-existent post', async () => {
    const commenter = await createUser({ username: 'commenter2' });
    const viewer = await asContextUser(commenter);
    const fakeId = '507f1f77bcf86cd799439011';

    const result = await graphql({
      schema,
      source: CREATE_COMMENT,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { postId: fakeId, content: 'hello?' } },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('creates a reply and increments the parent comment\'s repliesCount', async () => {
    const author = await createUser({ username: 'comment_author2' });
    const commenter = await createUser({ username: 'commenter3' });
    const post = await createPost(author);
    const viewer = await asContextUser(commenter);

    const top = await graphql({
      schema,
      source: CREATE_COMMENT,
      contextValue: contextFor(viewer as any),
      variableValues: { input: { postId: post._id.toString(), content: 'top level' } },
    });
    const topId = (top.data?.createComment as any).id;

    const reply = await graphql({
      schema,
      source: CREATE_COMMENT,
      contextValue: contextFor(viewer as any),
      variableValues: {
        input: { postId: post._id.toString(), content: 'a reply', parentCommentId: topId },
      },
    });
    expect(reply.errors).toBeUndefined();

    const list = await graphql({
      schema,
      source: GET_COMMENTS,
      contextValue: contextFor(viewer as any),
      variableValues: { postId: post._id.toString() },
    });

    expect(list.errors).toBeUndefined();
    const comments = list.data?.comments as any[];
    expect(comments).toHaveLength(1); // replies aren't top-level
    expect(comments[0].repliesCount).toBe(1);
  });
});
