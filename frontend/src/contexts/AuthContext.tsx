import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { TOKEN_KEY, USER_KEY } from '../api/client'
import { login as apiLogin } from '../api/auth'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser)

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password)
    const authUser: AuthUser = {
      username: result.username,
      name: result.name,
      role: result.role,
    }
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))
    setUser(authUser)
    return authUser
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
