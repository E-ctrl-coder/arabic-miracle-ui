import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  publicDir: 'public',
  css: {
    postcss: './postcss.config.cjs'
  },
  server: {
    cors: true
  },
  build: {
    outDir: 'dist'
  }
});