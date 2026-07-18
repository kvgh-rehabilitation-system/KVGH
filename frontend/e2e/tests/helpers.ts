import type { Page } from '@playwright/test'

/** 帳號密碼一律 1234（backend entrypoint seed，見根目錄 CLAUDE.md） */
export const PASSWORD = '1234'

/** 四角色代表帳號與登入後首頁（roleHome 契約） */
export const ROLES = [
  { username: 'admin01', role: 'admin', homePath: '/admin/dashboard' },
  { username: 'doctor01', role: 'doctor', homePath: '/doctor/dashboard' },
  { username: 'nurse01', role: 'nurse', homePath: '/nurse/dashboard' },
  { username: 'patient01', role: 'patient', homePath: '/portal/dashboard' },
] as const

/**
 * 掛 console error 收集器（必須在 goto 前掛，才收得到載入期錯誤）。
 * 回傳的陣列會隨頁面活動累積；spec 結尾斷言其為空。
 * allowlist：預期內的噪音（如降級模式下資源 404），比中的訊息不算失敗。
 */
export function collectErrors(page: Page, allowlist: RegExp[] = []): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !allowlist.some((re) => re.test(msg.text()))) {
      errors.push(`console: ${msg.text()}`)
    }
  })
  return errors
}

/** 走真實登入表單（不偷塞 token）：填帳密→送出。後續由呼叫端斷言導向。 */
export async function login(page: Page, username: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-username').fill(username)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
}
