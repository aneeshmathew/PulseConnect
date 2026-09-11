import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { User } from '../../src/models/User';

// Regression coverage for the bug class documented in
// backend/src/graphql/resolvers/auth.resolvers.ts (the User.friends field
// resolver) and DEVELOPMENT.md's changelog: `parent.friends` is a raw
// array of ObjectIds on the lean Mongo doc. Without a field resolver that
// batch-loads the real User documents, GraphQL tries to resolve each raw
// ObjectId as a full User, fails on non-nullable fields, and silently
// nulls out the ENTIRE list — while `friendsCount` (computed straight from
// the id array) stays correct. That exact mismatch (right count, empty
// list) is what these tests make impossible to reintroduce unnoticed.

const GET_USER = /* GraphQL */ `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      username
      friendsCount
      friends {
        id
        username
        fullName
      }
    }
  }
`;

describe('User.friends field resolver', () => {
  it('returns fully-populated friend objects, not null, for a user with friends', async () => {
    const me = await createUser({ username: 'alice' });
    const friendA = await createUser({ username: 'bob' });
    const friendB = await createUser({ username: 'carol' });

    await User.findByIdAndUpdate(me._id, {
      $set: { friends: [friendA._id, friendB._id] },
    });

    const viewer = await asContextUser(me);
    const result = await graphql({
      schema,
      source: GET_USER,
      contextValue: contextFor(viewer as any),
      variableValues: { id: me._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    const user = result.data?.user as any;

    // The exact regression: count must match the populated list length,
    // and the list itself must contain real user objects, not nulls.
    expect(user.friendsCount).toBe(2);
    expect(user.friends).toHaveLength(2);
    const usernames = user.friends.map((f: any) => f.username).sort();
    expect(usernames).toEqual(['bob', 'carol']);
    user.friends.forEach((f: any) => {
      expect(f.id).toBeTruthy();
      expect(typeof f.fullName).toBe('string');
      expect(f.fullName.length).toBeGreaterThan(0);
    });
  });

  it('returns an empty array (not null) for a user with no friends', async () => {
    const me = await createUser({ username: 'lonely' });
    const viewer = await asContextUser(me);

    const result = await graphql({
      schema,
      source: GET_USER,
      contextValue: contextFor(viewer as any),
      variableValues: { id: me._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data?.user as any).friendsCount).toBe(0);
    expect((result.data?.user as any).friends).toEqual([]);
  });

  it('drops a friend id pointing at a since-deleted account instead of erroring', async () => {
    const me = await createUser({ username: 'dana' });
    const ghost = await createUser({ username: 'ghost' });
    await User.findByIdAndUpdate(me._id, { $set: { friends: [ghost._id] } });
    await User.findByIdAndDelete(ghost._id);

    const viewer = await asContextUser(me);
    const result = await graphql({
      schema,
      source: GET_USER,
      contextValue: contextFor(viewer as any),
      variableValues: { id: me._id.toString() },
    });

    expect(result.errors).toBeUndefined();
    // friendsCount reflects the raw (stale) id array by design — asserting
    // it here documents current behavior so a future change to that is a
    // deliberate decision, not an accidental regression.
    expect((result.data?.user as any).friendsCount).toBe(1);
    expect((result.data?.user as any).friends).toEqual([]);
  });
});
