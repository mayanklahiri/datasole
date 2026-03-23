import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/__ds': {
        target: 'http://localhost:4001',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
});
