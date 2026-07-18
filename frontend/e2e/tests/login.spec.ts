import { test, expect } from '@playwright/test'

// 大功能煙霧測試:四角色能登入、登入後首頁能渲染、過程無 JS 錯誤。
// 只驗「頁面存活」層級的穩定契約(testid 與導向路徑),不驗頁面內容細節——
// 開發中改版面/文案/資料不應弄斷這些測試。
// 帳號來源:backend entrypoint 自動 seed(密碼一律 1234,見根目錄 CLAUDE.md)。

const roles = [
  { username: 'admin01', role: 'admin', homePath: '/admin/dashboard' },
  { username: 'doctor01', role: 'doctor', homePath: '/doctor/dashboard' },
  { username: 'nurse01', role: 'nurse', homePath: '/nurse/dashboard' },
  { username: 'patient01', role: 'patient', homePath: '/portal/dashboard' },
] as const

// 預期內的噪音(不算失敗)。目前為空;若未來出現「空資料下預期的資源 404」
// 之類的 console error,把可辨識的訊息片段加進來並附註原因。
const consoleErrorAllowlist: RegExp[] = []

for (const { username, role, homePath } of roles) {
  test(`${role}(${username})登入後首頁渲染成功且無 console error`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !consoleErrorAllowlist.some((re) => re.test(msg.text()))) {
        errors.push(`console: ${msg.text()}`)
      }
    })

    await page.goto('/login')
    await page.getByTestId('login-username').fill(username)
    await page.getByTestId('login-password').fill('1234')
    await page.getByTestId('login-submit').click()

    await expect(page).toHaveURL(new RegExp(homePath.replaceAll('/', '\\/')))
    await expect(page.getByTestId(`${role}-home`)).toBeVisible({ timeout: 15_000 })
    expect(errors, errors.join('\n')).toEqual([])
  })
}
