/** 病患入口 API（/api/patient/*）：儀表板、看診/計畫查詢、影片上傳與進度輪詢。 */
import { client } from './client'
import type {
  PatientDashboard,
  PortalPlanDetail,
  PortalPlanListItem,
  SubmissionProgress,
  Visit,
} from '../types'

export async function getDashboard() {
  const { data } = await client.get<PatientDashboard>('/patient/dashboard')
  return data
}

export async function listVisits() {
  const { data } = await client.get<Visit[]>('/patient/visits')
  return data
}

export async function listPlans() {
  const { data } = await client.get<PortalPlanListItem[]>('/patient/rehabilitation-plans')
  return data
}

export async function getPlan(planId: number | string) {
  const { data } = await client.get<PortalPlanDetail>(`/patient/rehabilitation-plans/${planId}`)
  return data
}

// ---- 影片上傳 ----

/** 上傳復健影片（multipart）。回傳 202 + 進度物件，後續用 getSubmissionProgress 輪詢。 */
export async function uploadSubmission(
  planId: number | string,
  planItemId: number,
  file: File,
) {
  const form = new FormData()
  form.append('plan_item_id', String(planItemId))
  form.append('video', file)
  const { data } = await client.post<SubmissionProgress>(
    `/patient/rehabilitation-plans/${planId}/submissions`,
    form,
  )
  return data
}

export async function getSubmissionProgress(submissionId: number | string) {
  const { data } = await client.get<SubmissionProgress>(`/patient/submissions/${submissionId}`)
  return data
}

export async function deleteSubmission(submissionId: number | string) {
  const { data } = await client.delete(`/patient/submissions/${submissionId}`)
  return data
}
