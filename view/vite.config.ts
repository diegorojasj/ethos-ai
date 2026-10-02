import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Forward the chat widget's /api calls to the Django AI service.
    proxy: {
      '/api': process.env.API_TARGET ?? 'http://localhost:8000',
    },
  },
});
