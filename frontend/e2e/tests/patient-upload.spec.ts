import { Buffer } from 'node:buffer'
import { test, expect } from '@playwright/test'
import { collectErrors, login } from './helpers'

// 病患核心流程前半段:上傳練習影片 → 進入分析佇列。
// 前置:demo seed 為 pl01(patient01)綁了「已就緒」導師影片(EXTRACTED+ANNOTATED,
// 磁碟無檔案,上傳擋門只看 DB 狀態),上傳按鈕因此解鎖。
// e2e stack 無 worker:上傳 202 後任務停在 broker,狀態停留「排隊等待分析中」
// ——這正是本 spec 的斷言終點(轉檔之後的鏈路由 worker-integration 覆蓋)。

// 預期內的噪音:導師影片與範例資源磁碟無檔案,載入 404 是 seed 降級慣例
const DEGRADED_404 = [/the server responded with a status of 404/]

test('病患上傳練習影片:按鈕解鎖、上傳後進入分析佇列', async ({ page }) => {
  const errors = collectErrors(page, DEGRADED_404)

  await login(page, 'patient01')
  await page.waitForURL(/\/portal\/dashboard/)
  await page.goto('/portal/rehabilitation-plans')
  await expect(page.getByTestId('patient-plans')).toBeVisible({ timeout: 15_000 })
  await page.locator('a[href^="/portal/rehabilitation-plans/"]').first().click()
  await expect(page.getByTestId('patient-plan-detail')).toBeVisible({ timeout: 15_000 })

  // 就緒導師影片 → 按鈕解鎖(未就緒時會是停用的「導師影片準備中」)
  const uploadButton = page.getByRole('button', { name: '上傳練習影片' }).first()
  await expect(uploadButton).toBeEnabled()

  // 點按鈕會開系統選檔窗,e2e 直接對隱藏 input 餵檔(內容不需是合法影片:
  // 上傳端點收任意檔,轉檔失敗是 worker 的事,此處只驗上傳與佇列狀態)
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: 'practice.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('e2e-fake-video'),
    })

  // 202 → 按鈕換成進度膠囊(排隊等待分析中 = statusLabel PENDING 的病患文案)
  await expect(page.getByText('排隊等待分析中').first()).toBeVisible({ timeout: 15_000 })

  // 重新整理:上傳紀錄出現新的一筆,狀態仍在分析佇列
  await page.reload()
  await expect(page.getByTestId('patient-plan-detail')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('排隊等待分析中').first()).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})
