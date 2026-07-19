import { test, expect } from '@playwright/test'
import { collectErrors, login } from './helpers'

// 復健閉環後半段:護理師送出審核回饋 → 病患端看到留言。
// 目標挑「最後一列」待審件:避開 nurse-review.spec 讀取中的第一列(平行執行
// 不互踩),且不綁定特定病患——同 stack 重跑/CI retry 時前一輪已審掉的件
// 不會讓 spec 卡死(seed 的待審件有多筆)。病患帳號從列上病歷號推導
// (seed 慣例:P0000NN ↔ patientNN)。
// 審核頁對 seed 資料照舊降級(analysis-data/pose3d/媒體 404 屬預期噪音)。

const DEGRADED_404 = [/the server responded with a status of 404/]
const FEEDBACK = `動作有進步,注意呼吸節奏(e2e ${Date.now()})`

test('護理師審核回饋後,病患在計畫頁看到留言', async ({ page, browser }) => {
  const errors = collectErrors(page, DEGRADED_404)

  // ---- 護理師端:挑最後一列待審件 → 選「通過」+ 留言 → 完成審核 ----
  await login(page, 'nurse01')
  await page.waitForURL(/\/nurse\/dashboard/)
  await page.goto('/nurse/submissions')
  await expect(page.getByTestId('nurse-submissions')).toBeVisible({ timeout: 15_000 })

  const pendingRows = page
    .locator('tr')
    .filter({ has: page.getByRole('link', { name: '審核', exact: true }) })
  await expect(pendingRows.first()).toBeVisible({ timeout: 15_000 })
  const row = pendingRows.last()
  // 病患欄第二行是病歷號(P0000NN)→ 對應登入帳號 patientNN(seed 慣例)
  const patientNumber = await row.locator('td').nth(1).locator('p').nth(1).innerText()
  const username = `patient${patientNumber.slice(-2)}`

  await row.getByRole('link', { name: '審核', exact: true }).click()
  await expect(page.getByTestId('nurse-review')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: '通過' }).click()
  await page.getByPlaceholder(/動作標準，繼續保持/).fill(FEEDBACK)
  await page.getByRole('button', { name: '完成審核' }).click()

  // 成功動畫後導回審核佇列 = 寫入成功(失敗會停在頁內 toast 錯誤)
  await page.waitForURL(/\/nurse\/submissions$/, { timeout: 15_000 })

  // ---- 病患端(獨立 context 免登出):逐計畫頁找到護理師留言 ----
  const patientContext = await browser.newContext()
  const patientPage = await patientContext.newPage()
  const patientErrors = collectErrors(patientPage, DEGRADED_404)

  await login(patientPage, username)
  await patientPage.waitForURL(/\/portal\/dashboard/)
  await patientPage.goto('/portal/rehabilitation-plans')
  await expect(patientPage.getByTestId('patient-plans')).toBeVisible({ timeout: 15_000 })

  const hrefs = await patientPage
    .locator('a[href^="/portal/rehabilitation-plans/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')!))
  expect(hrefs.length).toBeGreaterThan(0)

  let found = false
  for (const href of hrefs) {
    await patientPage.goto(href)
    await expect(patientPage.getByTestId('patient-plan-detail')).toBeVisible({ timeout: 15_000 })
    if ((await patientPage.getByText(FEEDBACK).count()) > 0) {
      found = true
      break
    }
  }
  expect(found, `${username} 的計畫頁應顯示審核回饋`).toBe(true)

  await patientContext.close()
  expect(errors, errors.join('\n')).toEqual([])
  expect(patientErrors, patientErrors.join('\n')).toEqual([])
})
