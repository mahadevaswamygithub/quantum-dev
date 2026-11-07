import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Listen on 0.0.0.0 for Docker container mapping
    watch: {
      // Docker bind mounts on Windows/macOS don't deliver file-change events,
      // so docker-compose.yml turns polling on via VITE_USE_POLLING.
      usePolling: process.env.VITE_USE_POLLING === 'true',
    },
  },
  build: {
    outDir: 'build', // Keeps compatibility with Dockerfile & Nginx setup
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  // REACT_APP_* kept so existing .env files and the Docker build arg still work.
  envPrefix: ['VITE_', 'REACT_APP_'],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
});
