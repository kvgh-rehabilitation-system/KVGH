import { client } from './client'
import type {
  AdminOverview,
  AdminTaskList,
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
} from '../types'

// ---- 帳號管理 ----

export async function listUsers(params: { role?: string; search?: string } = {}) {
  const { data } = await client.get<AdminUser[]>('/admin/users', { params })
  return data
}

export async function createUser(payload: AdminUserCreateInput) {
  const { data } = await client.post<AdminUser>('/admin/users', payload)
  return data
}

export async function updateUser(userId: number, payload: AdminUserUpdateInput) {
  const { data } = await client.patch<AdminUser>(`/admin/users/${userId}`, payload)
  return data
}

export async function resetPassword(userId: number, newPassword: string) {
  const { data } = await client.post<{ detail: string }>(
    `/admin/users/${userId}/reset-password`,
    { new_password: newPassword },
  )
  return data
}

export async function setActive(userId: number, isActive: boolean) {
  const { data } = await client.post<AdminUser>(`/admin/users/${userId}/set-active`, {
    is_active: isActive,
  })
  return data
}

/** 有關聯資料時後端會降級為停用（deleted: false） */
export async function deleteUser(userId: number) {
  const { data } = await client.delete<{ detail: string; deleted: boolean }>(
    `/admin/users/${userId}`,
  )
  return data
}

// ---- 系統總覽 ----

export async function getOverview() {
  const { data } = await client.get<AdminOverview>('/admin/overview')
  return data
}

// ---- 分析任務監控 ----

export async function listTasks(params: {
  analysis_status?: string
  page?: number
  page_size?: number
} = {}) {
  const { data } = await client.get<AdminTaskList>('/admin/tasks', { params })
  return data
}

export async function reanalyzeSubmission(submissionId: number) {
  const { data } = await client.post<{ detail: string; submission_id: number }>(
    `/admin/submissions/${submissionId}/reanalyze`,
  )
  return data
}
