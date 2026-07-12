import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // 遠端開發：VITE_API_TARGET=http://<server>:8000 npm run dev
      '/api': process.env.VITE_API_TARGET ?? 'http://localhost:8000',
    },
  },
})
