// 臨時 dev 驗證用設定（Claude 驗證 3D 素體用，可刪）：容器內以 host network 跑，
// API 走 nginx(:2000) 轉發
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:2000',
    },
  },
})
