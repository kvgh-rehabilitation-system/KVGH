import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { LoginPage } from './LoginPage'

// 3D Hero 走 WebGL，jsdom 跑不了也與表單行為無關——整模組換成空殼
vi.mock('../components/three/lazy', () => ({
  LazyHumanHero: () => null,
}))

// AuthContext.login 打真 API，元件測試只驗表單 → login 參數與導頁行為
const loginMock = vi.hoisted(() => vi.fn())
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: loginMock }),
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/nurse/dashboard" element={<div data-testid="nurse-home" />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  // 沒開 globals 時 RTL 不會自動掛 cleanup，需手動卸載避免 DOM 疊加
  afterEach(cleanup)

  test('e2e 錨點 testid 存在，欄位未填時送出鈕停用', () => {
    renderLogin()
    expect(screen.getByTestId('login-username')).toBeInTheDocument()
    expect(screen.getByTestId('login-password')).toBeInTheDocument()
    expect(screen.getByTestId('login-submit')).toBeDisabled()
  })

  test('填帳密送出 → 以輸入值呼叫 login，成功後導向角色首頁', async () => {
    loginMock.mockResolvedValue({ role: 'nurse' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByTestId('login-username'), 'nurse01')
    await user.type(screen.getByTestId('login-password'), '1234')
    await user.click(screen.getByTestId('login-submit'))

    expect(loginMock).toHaveBeenCalledWith('nurse01', '1234')
    await waitFor(() => expect(screen.getByTestId('nurse-home')).toBeInTheDocument())
  })

  test('登入失敗 → 表單內顯示錯誤訊息，不導頁', async () => {
    loginMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByTestId('login-username'), 'nurse01')
    await user.type(screen.getByTestId('login-password'), 'wrong')
    await user.click(screen.getByTestId('login-submit'))

    // 非 axios 錯誤走通用文案（apiErrorMessage fallback）
    expect(await screen.findByText('發生錯誤，請稍後再試')).toBeInTheDocument()
    expect(screen.queryByTestId('nurse-home')).not.toBeInTheDocument()
  })
})
