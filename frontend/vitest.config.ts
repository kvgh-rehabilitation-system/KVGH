import path from 'node:path'
import { defineConfig } from 'vitest/config'

// 獨立於 vite.config.ts：專案是 vite 8（rolldown），vitest 走自帶的 vite
// 跑測試即可，不共用建置設定（codeSplitting/proxy 與測試無關，混用徒增相容風險）。
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // 不開 globals：測試檔顯式 import { test, expect } from 'vitest'，
    // 免動 oxlint / tsconfig 的全域設定
  },
})
