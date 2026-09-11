import { describe, it, expect } from 'vitest';
import { graphql } from 'graphql';
import { schema, contextFor } from '../helpers/schema';
import { createUser, asContextUser } from '../helpers/factories';
import { User } from '../../src/models/User';

// Coverage for the auth flow: register/login/me. These resolvers are the
// entry point to every authenticated feature in the app, and rely on
// several easy-to-regress details — case-insensitive username/email
// uniqueness, the password never leaking out over GraphQL, and bcrypt
// actually being used for comparison rather than a plaintext check — none
// of which had test coverage before this.

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        username
        email
      }
    }
  }
`;

const LOGIN = /* GraphQL */ `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        username
      }
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      id
      username
    }
  }
`;

describe('register', () => {
  const validInput = {
    username: 'newuser',
    email: 'newuser@example.com',
    password: 'Password123',
    firstName: 'New',
    lastName: 'User',
  };

  it('creates a user and returns a token without leaking the password', async () => {
    const result = await graphql({
      schema,
      source: REGISTER,
      contextValue: contextFor(null),
      variableValues: { input: validInput },
    });

    expect(result.errors).toBeUndefined();
    const payload = result.data?.register as any;
    expect(payload.token).toBeTruthy();
    expect(payload.user.username).toBe('newuser');
    expect(payload.user.password).toBeUndefined();

    // Confirm the password is actually hashed at rest, not stored plaintext.
    const stored = await User.findOne({ username: 'newuser' }).select('+password');
    expect(stored?.password).not.toBe('Password123');
  });

  it('rejects a duplicate email regardless of casing', async () => {
    await createUser({ email: 'taken@example.com', username: 'first_taker' });

    const result = await graphql({
      schema,
      source: REGISTER,
      contextValue: contextFor(null),
      variableValues: { input: { ...validInput, username: 'second_taker', email: 'Taken@Example.com' } },
    });

    expect(result.errors?.[0]?.message).toMatch(/email already in use/i);
  });

  it('rejects a duplicate username regardless of casing', async () => {
    await createUser({ username: 'CoolName', email: 'cool1@example.com' });

    const result = await graphql({
      schema,
      source: REGISTER,
      contextValue: contextFor(null),
      variableValues: { input: { ...validInput, username: 'coolname', email: 'cool2@example.com' } },
    });

    expect(result.errors?.[0]?.message).toMatch(/username already taken/i);
  });
});

describe('login', () => {
  it('logs in with correct credentials and returns a usable token', async () => {
    await createUser({ username: 'loginuser', email: 'login@example.com', password: 'CorrectHorse123' });

    const result = await graphql({
      schema,
      source: LOGIN,
      contextValue: contextFor(null),
      variableValues: { email: 'login@example.com', password: 'CorrectHorse123' },
    });

    expect(result.errors).toBeUndefined();
    expect((result.data?.login as any).user.username).toBe('loginuser');
    expect((result.data?.login as any).token).toBeTruthy();
  });

  it('rejects an incorrect password with a generic message (no user enumeration)', async () => {
    await createUser({ username: 'wrongpass', email: 'wrongpass@example.com', password: 'CorrectHorse123' });

    const result = await graphql({
      schema,
      source: LOGIN,
      contextValue: contextFor(null),
      variableValues: { email: 'wrongpass@example.com', password: 'wrong-password' },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    expect(result.errors?.[0]?.message).toMatch(/invalid credentials/i);
  });

  it('rejects a non-existent email with the same generic message as a wrong password', async () => {
    const result = await graphql({
      schema,
      source: LOGIN,
      contextValue: contextFor(null),
      variableValues: { email: 'nobody@example.com', password: 'whatever123' },
    });

    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    expect(result.errors?.[0]?.message).toMatch(/invalid credentials/i);
  });
});

describe('me', () => {
  it('returns the current user when authenticated', async () => {
    const user = await createUser({ username: 'currentuser' });
    const viewer = await asContextUser(user);

    const result = await graphql({ schema, source: ME, contextValue: contextFor(viewer as any) });

    expect(result.errors).toBeUndefined();
    expect((result.data?.me as any).username).toBe('currentuser');
  });

  it('rejects with UNAUTHENTICATED when there is no logged-in user', async () => {
    const result = await graphql({ schema, source: ME, contextValue: contextFor(null) });

    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
    expect(result.data?.me).toBeNull();
  });
});
