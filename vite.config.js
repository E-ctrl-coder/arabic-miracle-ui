import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import copy from 'rollup-plugin-copy';

export default defineConfig({
  plugins: [
    react(),
    copy({
      targets: [
        { src: resolve(__dirname, 'عن التطبيق.html'), dest: 'dist' },
        { src: resolve(__dirname, 'كيفية الاستخدام.html'), dest: 'dist' },
        { src: resolve(__dirname, 'التسجيل.html'), dest: 'dist' },
        { src: resolve(__dirname, 'اتصل بنا.html'), dest: 'dist' },
        { src: resolve(__dirname, 'الإشعارات.html'), dest: 'dist' },
        { src: resolve(__dirname, 'الروابط.html'), dest: 'dist' },
        { src: resolve(__dirname, 'إعلانات تجارية.html'), dest: 'dist' }
      ]
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    cors: true
  }
});
