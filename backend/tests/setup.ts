import { beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  // Tests never go through createContext()/verifyToken() — they build a
  // GraphQLContext directly (see helpers/schema.ts) and call graphql()
  // against the schema. JWT_SECRET is set anyway purely so importing
  // graphql/context.ts doesn't throw if anything in the resolver chain
  // touches it.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-not-for-production';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000); // first run downloads the mongod binary — give it real time

afterEach(async () => {
  // Wipe every collection between tests so each test starts from a clean
  // database. Cheap at this data volume, and it means one test's seed
  // data can never leak into another test's assertions.
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
