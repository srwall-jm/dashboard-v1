import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    // Local stand-in for functions/_middleware.js. For /api/insights use `npm run preview`.
    proxy: {
      '/api/googleads': {
        target: 'https://googleads.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/googleads/, ''),
      },
    },
  },
});
