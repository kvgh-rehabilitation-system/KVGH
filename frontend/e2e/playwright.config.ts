import { defineConfig } from '@playwright/test'

// CI 跑法:官方 image mcr.microsoft.com/playwright:v<版本>-noble,
// 版本必須與 package.json 的 @playwright/test 完全同號(不同號瀏覽器版本會對不上)。
// 兩處一起升:package.json 依賴 + .gitlab-ci.yml 的 PLAYWRIGHT_IMAGE。
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // CI 內接 compose network 打 http://frontend;本機預設直打 dev stack
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:2000',
    trace: 'retain-on-failure',
  },
})
