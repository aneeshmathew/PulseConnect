import { mergeResolvers } from '@graphql-tools/merge';
import { GraphQLScalarType, Kind } from 'graphql';
import { authResolvers } from './auth.resolvers';
import { postResolvers } from './post.resolvers';
import { userResolvers } from './user.resolvers';
import { messageResolvers } from './message.resolvers';
import { subscriptionResolvers } from './subscription.resolvers';
import { commentResolvers, notificationResolvers, storyResolvers } from './other.resolvers';
import { videoResolvers } from './video.resolvers';
import { eventResolvers } from './event.resolvers';

// ── DateTime scalar ────────────────────────────────────────────────────────────
const dateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 date-time string',

  serialize(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    throw new TypeError(`DateTime cannot serialize value: ${JSON.stringify(value)}`);
  },

  parseValue(value: unknown) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new TypeError(`DateTime expects string or number, got: ${typeof value}`);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) throw new TypeError(`DateTime received invalid date: ${value}`);
    return d;
  },

  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING) {
      throw new TypeError(`DateTime expects a string literal, got: ${ast.kind}`);
    }
    const d = new Date(ast.value);
    if (isNaN(d.getTime())) throw new TypeError(`DateTime received invalid date literal: ${ast.value}`);
    return d;
  },
});

export const resolvers = mergeResolvers([
  { DateTime: dateTimeScalar },
  authResolvers,
  postResolvers,
  userResolvers,
  messageResolvers,
  subscriptionResolvers,
  commentResolvers,
  notificationResolvers,
  storyResolvers,
  videoResolvers,
  eventResolvers,
]) as any;
