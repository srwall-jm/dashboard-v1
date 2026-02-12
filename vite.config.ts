import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/sa360': {
        target: 'https://searchads360.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sa360/, ''),
      },
    },
  },
});