import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      '/__ds': {
        target: 'http://localhost:4002',
        ws: true,
      },
      '/__ds/datasole-worker.iife.min.js': {
        target: 'http://localhost:4002',
      },
      '/datasole-worker.iife.min.js': {
        target: 'http://localhost:4002',
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});
