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
  build: {
    // 唯一超過預設 500kB 的是 three.js vendor chunk（~900kB）：three 核心單套件就
    // >600kB 拆不下去，且已由 lazy.tsx 延遲載入不佔首屏——門檻設在它之上，
    // 讓「首屏 chunk 變肥」仍會觸發警告
    chunkSizeWarningLimit: 950,
    rolldownOptions: {
      output: {
        // 把大顆 vendor 從 index chunk 拆出，消除 500kB 警告並改善首載快取。
        // three 相關不設群組——已由 components/three/lazy.tsx 動態載入自成 chunk，
        // 在這裡設群組反而會把它捲進 eager 載入。
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'recharts', test: /node_modules[\\/](recharts|d3-|victory-vendor)/ },
            { name: 'framer-motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
})
