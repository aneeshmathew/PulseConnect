import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Route-level code splitting (see App.tsx's React.lazy() pages)
        // handles most of the "chunk larger than 500kB" warning. Vendor
        // splits below are only for packages that do not import each
        // other across chunk boundaries — a cycle like vendor →
        // vendor-apollo → vendor leaves minified imports undefined at
        // runtime (`TypeError: y is not a function`).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // Apollo, graphql, graphql-tag, and Apollo's small runtime
          // helpers must stay in one chunk. Matching only `/graphql/`
          // left graphql-tag in `vendor`, which imports `graphql` from
          // `vendor-apollo` and created a circular chunk.
          if (
            id.includes('@apollo/client') ||
            id.includes('@graphql-typed-document-node') ||
            id.includes('/graphql-tag/') ||
            id.includes('/graphql-ws/') ||
            id.includes('/graphql/') ||
            id.includes('/@wry/') ||
            id.includes('/optimism/') ||
            id.includes('/ts-invariant/') ||
            id.includes('/zen-observable') ||
            id.includes('/symbol-observable/') ||
            id.includes('/rehackt/')
          ) {
            return 'vendor-apollo';
          }
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          // Match the react packages themselves, not any path containing
          // `/react/` (that also caught scheduler/helpers and cycled
          // with the leftover `vendor` chunk).
          if (
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('/@remix-run/') ||
            id.includes('/scheduler/') ||
            id.includes('/node_modules/react/')
          ) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
