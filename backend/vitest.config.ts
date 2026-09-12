import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // All test files share one in-memory MongoDB instance (spun up once in
    // tests/setup.ts) and wipe collections between tests via afterEach —
    // running files in parallel would race those wipes against each
    // other's assertions, so keep it sequential.
    fileParallelism: false,
    server: {
      deps: {
        inline: [/graphql/],
      },
    },
  },
});
