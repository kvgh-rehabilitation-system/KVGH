import { test, expect } from '@playwright/test'
import { collectErrors, login } from './helpers'

// 醫師核心流程:計畫列表 → 計畫詳情 → 調整計畫(改頻率 + 摘要)→ 儲存。
// 走完整條寫入路徑(adjustPlan 會關閉舊版本、產生新版本快照)。
// 前置:demo seed 需有進行中的計畫(才有「調整計畫」按鈕)。

test('醫師調整計畫:改頻率存檔後回到計畫詳情', async ({ page }) => {
  const errors = collectErrors(page)

  await login(page, 'doctor01')
  await page.waitForURL(/\/doctor\/dashboard/)

  // 計畫列表 → 第一個計畫詳情
  await page.goto('/doctor/rehabilitation-plans')
  await page
    .locator('a[href^="/doctor/rehabilitation-plans/"]')
    .first()
    .click()
  await expect(page.getByTestId('plan-detail')).toBeVisible({ timeout: 15_000 })

  // 進入調整表單(僅進行中/待評估的計畫會有此按鈕;demo seed 保證存在)
  await page.getByTestId('plan-adjust').click()
  await expect(page.getByTestId('plan-form')).toBeVisible({ timeout: 15_000 })

  // 改第一個動作的頻率 + 必填調整摘要
  await page.getByTestId('item-frequency').first().fill('每週 2 次')
  await page.getByTestId('plan-change-summary').fill('E2E 測試:頻率調整為每週 2 次')
  await page.getByTestId('plan-save').click()

  // 儲存成功 = 導回計畫詳情頁(失敗會停在表單顯示錯誤)
  await expect(page.getByTestId('plan-detail')).toBeVisible({ timeout: 15_000 })
  await expect(page).toHaveURL(/\/doctor\/rehabilitation-plans\/\d+$/)

  expect(errors, errors.join('\n')).toEqual([])
})
