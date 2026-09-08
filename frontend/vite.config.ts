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
        // ✅ Route-level code splitting (see App.tsx's React.lazy() pages)
        // handles most of the "chunk larger than 500kB" warning by only
        // loading each page's own code on demand. This complements that:
        // groups third-party dependencies by how often they actually
        // change. App code changes on every deploy; @apollo/client,
        // framer-motion, and friends don't — splitting them into their own
        // chunks means a deploy that only touches app code lets returning
        // visitors keep every vendor chunk from browser cache instead of
        // redownloading all of it because it was bundled alongside
        // whatever page code changed.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@apollo/client') || id.includes('graphql-ws') || id.includes('/graphql/')) {
            return 'vendor-apollo';
          }
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
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
