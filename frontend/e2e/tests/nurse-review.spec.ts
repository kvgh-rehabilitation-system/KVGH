import { test, expect } from '@playwright/test'
import { collectErrors, login } from './helpers'

// 護理師核心流程:審核佇列 → 點進審核頁,驗「降級模式」正常呈現。
// 前置:demo seed——submission 有 DB 分析列但磁碟無任何檔案,
// analysis-data 與 pose3d 都 404,審核頁應自動降級(示意動畫 + 僅原始影片),
// 而不是白屏或炸版(見根目錄 CLAUDE.md「Seed 與真實資料的差異」)。

// 預期內的噪音:降級模式下 analysis-data/pose3d/影片檔 404 是設計行為,
// 瀏覽器仍會把資源 404 記成 console error——放行,其他錯誤照抓
const DEGRADED_404 = [/the server responded with a status of 404/]

test('審核頁對 seed 資料以降級模式呈現(示意動畫 + 原始影片)', async ({ page }) => {
  const errors = collectErrors(page, DEGRADED_404)

  await login(page, 'nurse01')
  await page.waitForURL(/\/nurse\/dashboard/)
  await page.goto('/nurse/submissions')
  await expect(page.getByTestId('nurse-submissions')).toBeVisible({ timeout: 15_000 })

  // 挑「審核」鈕(PENDING_REVIEW,必有分析結果)而非「查看」(可能是 FAILED 無分析)
  await page.getByTestId('review-link').filter({ hasText: '審核' }).first().click()
  await expect(page.getByTestId('nurse-review')).toBeVisible({ timeout: 15_000 })

  // 降級契約一:pose3d 404 → 3D 重播退回關節角度示意動畫
  await expect(page.getByText('示意動畫', { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  })
  // 降級契約二:analysis-data 404 → 比對影片退回原始影片並排(raw 模式限定的
  // 「病患上傳影片」浮標;有分析產物時預設是 2×2 對齊重播,不會出現此浮標)
  await expect(page.getByText('病患上傳影片')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})
