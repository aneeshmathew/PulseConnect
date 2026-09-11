import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, createPost, asContextUser } from '../helpers/factories';

// Regression coverage for the same bug CLASS as User.friends (see
// user-friends.test.ts and DEVELOPMENT.md's changelog entry 2026-08-22 (2)):
// `Post.tags` is a raw ObjectId array on posts returned by feed /
// exploreFeed / userPosts — none of those queries `.populate('tags')`.
// The Post.tags field resolver (post.resolvers.ts) is what makes tagged
// users resolve correctly regardless of which query returned the post.
// These tests would fail if that resolver were ever removed, or if a new
// post-fetching query bypassed it and relied on population instead.

const FEED = /* GraphQL */ `
  query Feed {
    feed(limit: 10) {
      posts {
        id
        content
        tags {
          id
          username
        }
      }
    }
  }
`;

const GET_POST = /* GraphQL */ `
  query GetPost($id: ID!) {
    post(id: $id) {
      id
      tags {
        id
        username
      }
    }
  }
`;

describe('Post.tags field resolver', () => {
  it('resolves tagged users on a post returned via feed (raw ObjectIds, no .populate)', async () => {
    const author = await createUser({ username: 'author1' });
    const taggedA = await createUser({ username: 'tagged_a' });
    const taggedB = await createUser({ username: 'tagged_b' });

    await createPost(author, { tags: [taggedA._id, taggedB._id] });

    const viewer = await asContextUser(author);
    const result = await graphql({
      schema,
      source: FEED,
      contextValue: contextFor(viewer as any),
    });

    expect(result.errors).toBeUndefined();
    const posts = (result.data?.feed as any).posts;
    expect(posts).toHaveLength(1);
    const usernames = posts[0].tags.map((t: any) => t.username).sort();
    expect(usernames).toEqual(['tagged_a', 'tagged_b']);
  });

  it('resolves tags identically via the single-post query (which DOES .populate)', async () => {
    const author = await createUser({ username: 'author2' });
    const tagged = await createUser({ username: 'tagged_c' });
    const post = await createPost(author, { tags: [tagged._id] });

    const viewer = await asContextUser(author);
    const result = await graphql({
      schema,
      source: GET_POST,
      contextValue: contextFor(viewer as any),
      variableValues: { id: post._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data?.post as any).tags).toEqual([
      { id: tagged._id.toString(), username: 'tagged_c' },
    ]);
  });

  it('returns an empty array for a post with no tags', async () => {
    const author = await createUser({ username: 'author3' });
    await createPost(author, { tags: [] });

    const viewer = await asContextUser(author);
    const result = await graphql({ schema, source: FEED, contextValue: contextFor(viewer as any) });

    expect(result.errors).toBeUndefined();
    expect((result.data?.feed as any).posts[0].tags).toEqual([]);
  });
});
