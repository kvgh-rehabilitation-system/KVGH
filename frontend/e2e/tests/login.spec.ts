import { test, expect } from '@playwright/test'
import { ROLES, collectErrors, login } from './helpers'

// 大功能煙霧測試:四角色能登入、登入後首頁能渲染、過程無 JS 錯誤。
// 只驗「頁面存活」層級的穩定契約(testid 與導向路徑),不驗頁面內容細節——
// 開發中改版面/文案/資料不應弄斷這些測試。

for (const { username, role, homePath } of ROLES) {
  test(`${role}(${username})登入後首頁渲染成功且無 console error`, async ({ page }) => {
    const errors = collectErrors(page)

    await login(page, username)

    await expect(page).toHaveURL(new RegExp(homePath.replaceAll('/', '\\/')))
    await expect(page.getByTestId(`${role}-home`)).toBeVisible({ timeout: 15_000 })
    expect(errors, errors.join('\n')).toEqual([])
  })
}
