import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API server (server/index.ts) — run with `npm run dev`
      '/api': 'http://localhost:8787',
    },
  },
})
