import type { Role } from '../types'

/** 各角色登入後的首頁路徑；App.tsx 根路由重導與 RequireRole 也引用此表，改路徑只需改這裡 */
export const roleHome: Record<Role, string> = {
  admin: '/admin/dashboard',
  doctor: '/doctor/dashboard',
  nurse: '/nurse/dashboard',
  patient: '/portal/dashboard',
}
