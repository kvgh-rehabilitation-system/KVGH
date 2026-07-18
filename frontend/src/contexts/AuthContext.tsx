/**
 * 登入狀態 context 與取用 hook；狀態的建立與寫入在 AuthProvider.tsx
 * （元件與非元件分檔，維持 fast refresh）。
 */
import { createContext, useContext } from 'react'
import type { AuthUser } from '../types'

export interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => void
}

/** 僅供 AuthProvider 掛 Provider 用；元件請一律走 useAuth()，勿直接 useContext。 */
export const AuthContext = createContext<AuthContextValue | null>(null)

/** 取用登入狀態；在 AuthProvider 外呼叫直接拋錯（開發期就抓到掛錯位置）。 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
