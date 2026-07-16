/** 護理師端 API（/api/nurse/*）：審核、動作管理、回報、導師影片庫與標註。 */
import axios from 'axios'

import { client } from './client'
import type {
  AnalysisData,
  AnnotationInfo,
  NurseDashboard,
  NursePatientDetail,
  NursePatientRow,
  NurseReport,
  PlanDetail,
  PlanSubmissionsView,
  NurseReportCreate,
  PlanItemInput,
  PlanItemsView,
  ReviewSubmit,
  SubmissionDetail,
  SubmissionListResponse,
  TeacherVideo,
  TeacherVideoFolder,
} from '../types'

export async function getDashboard() {
  const { data } = await client.get<NurseDashboard>('/nurse/dashboard')
  return data
}

export async function listMyPatients(params: {
  scope?: 'mine' | 'all'
  search?: string
  plan_status?: string
}) {
  const { data } = await client.get<NursePatientRow[]>('/nurse/patients', { params })
  return data
}

export async function getPatient(patientId: number | string) {
  const { data } = await client.get<NursePatientDetail>(`/nurse/patients/${patientId}`)
  return data
}

export async function getPlan(planId: number | string) {
  const { data } = await client.get<PlanDetail>(`/nurse/plans/${planId}`)
  return data
}

export async function getPlanSubmissions(planId: number | string) {
  const { data } = await client.get<PlanSubmissionsView>(`/nurse/plans/${planId}/submissions`)
  return data
}

// ---- 影片審核 ----

export async function listSubmissions(params: {
  status?: string
  decision?: string
  search?: string
}) {
  const { data } = await client.get<SubmissionListResponse>('/nurse/submissions', { params })
  return data
}

export async function getSubmission(submissionId: number | string) {
  const { data } = await client.get<SubmissionDetail>(`/nurse/submissions/${submissionId}`)
  return data
}

/**
 * 儀表板明細（動作分解卡、相似度曲線、關節偏差序列）。
 * seed 資料沒有磁碟產物會 404 → 回 null，頁面優雅降級。
 */
export async function getAnalysisData(
  submissionId: number | string,
): Promise<AnalysisData | null> {
  try {
    const { data } = await client.get<AnalysisData>(
      `/nurse/submissions/${submissionId}/analysis-data`,
    )
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}

export async function reviewSubmission(submissionId: number | string, payload: ReviewSubmit) {
  const { data } = await client.post<SubmissionDetail>(
    `/nurse/submissions/${submissionId}/review`,
    payload,
  )
  return data
}

// ---- 回報醫生 ----

export async function listReports() {
  const { data } = await client.get<NurseReport[]>('/nurse/reports')
  return data
}

export async function createReport(payload: NurseReportCreate) {
  const { data } = await client.post<NurseReport>('/nurse/reports', payload)
  return data
}

// ---- 動作管理 ----

export async function getPlanItems(planId: number | string) {
  const { data } = await client.get<PlanItemsView>(`/nurse/plans/${planId}/items`)
  return data
}

export async function addPlanItem(planId: number | string, payload: PlanItemInput) {
  const { data } = await client.post<PlanItemsView>(`/nurse/plans/${planId}/items`, payload)
  return data
}

export async function updatePlanItem(
  planId: number | string,
  itemId: number,
  payload: Partial<PlanItemInput>,
) {
  const { data } = await client.put<PlanItemsView>(
    `/nurse/plans/${planId}/items/${itemId}`,
    payload,
  )
  return data
}

export async function deletePlanItem(planId: number | string, itemId: number) {
  const { data } = await client.delete<PlanItemsView>(`/nurse/plans/${planId}/items/${itemId}`)
  return data
}

// ---- 導師影片 ----

export async function listTeacherVideos() {
  const { data } = await client.get<TeacherVideo[]>('/nurse/teacher-videos')
  return data
}

/** 獨立上傳到影片庫（不綁定動作） */
export async function createTeacherVideo(name: string, file: File) {
  const form = new FormData()
  form.append('name', name)
  form.append('video', file)
  const { data } = await client.post<TeacherVideo>('/nurse/teacher-videos', form)
  return data
}

export async function uploadTeacherVideo(
  planId: number | string,
  itemId: number,
  name: string,
  file: File,
) {
  const form = new FormData()
  form.append('name', name)
  form.append('video', file)
  const { data } = await client.post<TeacherVideo>(
    `/nurse/plans/${planId}/items/${itemId}/teacher-video`,
    form,
  )
  return data
}

export async function getTeacherVideo(teacherVideoId: number | string) {
  const { data } = await client.get<TeacherVideo>(`/nurse/teacher-videos/${teacherVideoId}`)
  return data
}

export async function deleteTeacherVideo(teacherVideoId: number | string) {
  const { data } = await client.delete(`/nurse/teacher-videos/${teacherVideoId}`)
  return data
}

/** 改名與/或移動資料夾（folder_id 傳 null 移回未分類） */
export async function updateTeacherVideo(
  teacherVideoId: number | string,
  patch: { name?: string; folder_id?: number | null },
) {
  const { data } = await client.patch<TeacherVideo>(
    `/nurse/teacher-videos/${teacherVideoId}`,
    patch,
  )
  return data
}

/** 重新執行 2D/3D 萃取（保留影片與標註） */
export async function reextractTeacherVideo(teacherVideoId: number | string) {
  const { data } = await client.post<TeacherVideo>(
    `/nurse/teacher-videos/${teacherVideoId}/re-extract`,
  )
  return data
}

// ---- 導師影片資料夾 ----

export async function listTeacherVideoFolders() {
  const { data } = await client.get<TeacherVideoFolder[]>('/nurse/teacher-video-folders')
  return data
}

export async function createTeacherVideoFolder(name: string) {
  const { data } = await client.post<TeacherVideoFolder>('/nurse/teacher-video-folders', {
    name,
  })
  return data
}

export async function renameTeacherVideoFolder(folderId: number, name: string) {
  const { data } = await client.patch<TeacherVideoFolder>(
    `/nurse/teacher-video-folders/${folderId}`,
    { name },
  )
  return data
}

export async function deleteTeacherVideoFolder(folderId: number) {
  const { data } = await client.delete(`/nurse/teacher-video-folders/${folderId}`)
  return data
}

// ---- 導師影片標註 ----

export async function getAnnotation(teacherVideoId: number | string) {
  const { data } = await client.get<AnnotationInfo>(
    `/nurse/teacher-videos/${teacherVideoId}/annotation`,
  )
  return data
}

export async function submitAnnotation(teacherVideoId: number | string, frames: number[]) {
  const { data } = await client.put<AnnotationInfo>(
    `/nurse/teacher-videos/${teacherVideoId}/annotation`,
    { frames },
  )
  return data
}

// ---- 重新分析 ----

export async function reanalyzeSubmission(submissionId: number | string) {
  const { data } = await client.post(`/nurse/submissions/${submissionId}/reanalyze`)
  return data
}
