import { test, expect } from '@playwright/test'
import { collectErrors, login } from './helpers'

// 四角色主要工作頁巡檢:登入後開自己最常用的清單頁,驗「頁面存活」與無 JS 錯誤。
// 需要 demo seed(python -m app.seed --demo)讓清單有真資料——渲染路徑更完整;
// 但斷言只到 testid 層級,空資料也應通過。

const PAGES = [
  { username: 'patient01', path: '/portal/rehabilitation-plans', testId: 'patient-plans', name: '病患計畫列表' },
  { username: 'doctor01', path: '/doctor/patients', testId: 'doctor-patients', name: '醫師病患列表' },
  { username: 'nurse01', path: '/nurse/submissions', testId: 'nurse-submissions', name: '護理師審核佇列' },
  { username: 'admin01', path: '/admin/users', testId: 'admin-users', name: '管理員帳號管理' },
] as const

for (const { username, path, testId, name } of PAGES) {
  test(`${name}(${path})渲染成功且無 console error`, async ({ page }) => {
    const errors = collectErrors(page)

    await login(page, username)
    await page.waitForURL(/dashboard/)
    await page.goto(path)

    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15_000 })
    expect(errors, errors.join('\n')).toEqual([])
  })
}
