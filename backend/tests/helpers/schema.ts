import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../src/graphql/typedefs';
import { resolvers } from '../../src/graphql/resolvers';
import { createLoaders } from '../../src/lib/dataloader';
import { pubsub } from '../../src/graphql/context';
import type { GraphQLContext } from '../../src/graphql/context';
import type { IUser } from '../../src/models/User';

// The exact same schema construction as backend/src/index.ts — tests run
// real resolvers against a real (in-memory) database, not mocks.
export const schema = makeExecutableSchema({ typeDefs, resolvers });

/**
 * Builds a context shaped identically to what createContext() hands
 * resolvers in production (backend/src/graphql/context.ts) — a lean,
 * password-stripped user doc, a shared pubsub, and a fresh set of
 * DataLoaders. Tests call graphql() directly against `schema`, bypassing
 * HTTP/JWT entirely, so this is the one place "logged in as X" gets
 * constructed. A fresh loader set per call matches one-per-request in prod
 * and avoids one test's DataLoader cache leaking into another's.
 */
export function contextFor(user: IUser | null): GraphQLContext {
  return { user, pubsub, loaders: createLoaders() };
}
