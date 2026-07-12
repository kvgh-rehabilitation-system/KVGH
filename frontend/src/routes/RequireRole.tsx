import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { roleHome } from '../pages/LoginPage'
import type { Role } from '../types'

/** 角色守衛：未登入導向登入頁；角色不符導回自己的首頁 */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (user.role !== role) return <Navigate to={roleHome[user.role]} replace />
  return <>{children}</>
}
