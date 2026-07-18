import { expect, test } from 'vitest'
import { roleHome } from './roleHome'

// App.tsx 根路由重導、RequireRole 與 e2e 測試都依賴這張表——路徑是穩定契約
test('四角色首頁路徑', () => {
  expect(roleHome).toEqual({
    admin: '/admin/dashboard',
    doctor: '/doctor/dashboard',
    nurse: '/nurse/dashboard',
    patient: '/portal/dashboard',
  })
})
