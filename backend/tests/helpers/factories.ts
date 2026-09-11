import { User, IUser } from '../../src/models/User';
import { Post } from '../../src/models/Post';

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

/** Creates a real, saved User document with sane defaults for anything not overridden. */
export async function createUser(overrides: Record<string, any> = {}): Promise<IUser> {
  const suffix = unique('u');
  return User.create({
    username: overrides.username ?? `user_${suffix}`,
    email: overrides.email ?? `${suffix}@example.com`,
    password: overrides.password ?? 'Password123',
    firstName: overrides.firstName ?? 'Test',
    lastName: overrides.lastName ?? 'User',
    ...overrides,
  });
}

/**
 * Returns the same shape createContext() produces for a logged-in request:
 * a lean, password-stripped user doc. Always re-fetches from the DB rather
 * than reusing the in-memory document returned by createUser(), so tests
 * that mutate friends/friendRequests/etc. via User.findByIdAndUpdate see
 * the current state, not a stale in-memory snapshot.
 */
export async function asContextUser(user: IUser) {
  return User.findById(user._id).select('-password').lean();
}

/** Creates a real, saved Post document authored by `author`. */
export async function createPost(author: IUser, overrides: Record<string, any> = {}) {
  return Post.create({
    author: author._id,
    content: overrides.content ?? 'hello world',
    ...overrides,
  });
}
