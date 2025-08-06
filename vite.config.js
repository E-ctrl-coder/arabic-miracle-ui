// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';      // or remove if you’re not using React
import { execSync } from 'child_process';

export default defineConfig({
  plugins: [
    // 1) Build QAC JSON before Vite bundles
    {
      name: 'build-qac-json',
      apply: 'serve',     // run during "npm run dev"
      buildStart() {
        try {
          console.log('\n⏳  Running: npm run build-qac\n');
          execSync('npm run build-qac', { stdio: 'inherit' });
          console.log('✅  QAC JSON build complete\n');
        } catch (err) {
          console.error('⛔️  build-qac failed:', err);
          process.exit(1);
        }
      }
    },

    // 2) Your other plugins
    react(),
  ],

  // 3) Any other Vite options here
  root: process.cwd(),
  build: {
    outDir: 'dist',
  },
});