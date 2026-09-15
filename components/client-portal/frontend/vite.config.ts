import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/issue': 'http://localhost:5000',
      '/revoke': 'http://localhost:5000',
      '/track': 'http://localhost:5000',
      '/verify': 'http://localhost:5000',
      '/api': 'http://localhost:5000',
    },
  },
});
