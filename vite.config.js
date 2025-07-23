// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Copy all static files from public/, including our generated quran-qac.json
  publicDir: 'public',

  plugins: [react()],
  
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },

  build: {
    // Make sure .json files in public/ are treated as assets to copy to dist/
    assetsInclude: ['**/*.json']
  }
})
