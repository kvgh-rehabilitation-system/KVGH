/** 醫生端 API（/api/doctor/*）：儀表板、病患/看診、計畫生命週期、回報審閱。 */
import axios from 'axios'

import { client } from './client'
import type {
  AnalysisData,
  DoctorDashboard,
  NurseReport,
  PatientDetail,
  PatientListItem,
  PlanDetail,
  PlanItemInput,
  PlanListItem,
  PlanListSummary,
  PlanSubmissionsView,
  SubmissionDetail,
  Visit,
} from '../types'

export async function getDashboard() {
  const { data } = await client.get<DoctorDashboard>('/doctor/dashboard')
  return data
}

export async function listPatients(params: {
  search?: string
  visit_type?: string
  rehab_status?: string
}) {
  const { data } = await client.get<PatientListItem[]>('/doctor/patients', { params })
  return data
}

export async function getPatient(patientId: number | string) {
  const { data } = await client.get<PatientDetail>(`/doctor/patients/${patientId}`)
  return data
}

export async function getSubmission(submissionId: number | string) {
  const { data } = await client.get<SubmissionDetail>(`/doctor/submissions/${submissionId}`)
  return data
}

/** 儀表板明細；磁碟無產物（seed 資料）404 → 回 null，頁面優雅降級。 */
export async function getAnalysisData(
  submissionId: number | string,
): Promise<AnalysisData | null> {
  try {
    const { data } = await client.get<AnalysisData>(
      `/doctor/submissions/${submissionId}/analysis-data`,
    )
    return data
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null
    throw error
  }
}

export async function listPatientVisits(patientId: number | string) {
  const { data } = await client.get<Visit[]>(`/doctor/patients/${patientId}/visits`)
  return data
}

export async function createVisit(
  patientId: number | string,
  payload: {
    chief_complaint: string
    diagnosis: string
    assessment: string
    rehab_decision: string
    follow_up_date: string | null
  },
) {
  const { data } = await client.post<{ id: number; rehab_decision: string }>(
    `/doctor/patients/${patientId}/visits`,
    payload,
  )
  return data
}

export async function getPlanSummary() {
  const { data } = await client.get<PlanListSummary>('/doctor/rehabilitation-plans/summary')
  return data
}

export async function listPlans(params: { search?: string; status?: string }) {
  const { data } = await client.get<PlanListItem[]>('/doctor/rehabilitation-plans', { params })
  return data
}

export async function getPlan(planId: number | string) {
  const { data } = await client.get<PlanDetail>(`/doctor/rehabilitation-plans/${planId}`)
  return data
}

export async function createPlan(
  patientId: number | string,
  payload: {
    name: string
    goals: string[]
    items: PlanItemInput[]
    nurse_id: number | null
    start_date: string
    evaluation_date: string | null
  },
) {
  const { data } = await client.post<{ id: number }>(
    `/doctor/patients/${patientId}/rehabilitation-plans`,
    payload,
  )
  return data
}

export async function adjustPlan(
  planId: number | string,
  payload: {
    change_summary: string
    goals: string[]
    items: PlanItemInput[]
    evaluation_date: string | null
  },
) {
  const { data } = await client.post<{ id: number }>(
    `/doctor/rehabilitation-plans/${planId}/adjust`,
    payload,
  )
  return data
}

export async function closePlan(planId: number | string) {
  const { data } = await client.post<{ id: number; status: string }>(
    `/doctor/rehabilitation-plans/${planId}/close`,
  )
  return data
}

export async function listNurses() {
  const { data } = await client.get<{ id: number; name: string }[]>('/doctor/nurses')
  return data
}

export async function getPlanSubmissions(planId: number | string) {
  const { data } = await client.get<PlanSubmissionsView>(
    `/doctor/rehabilitation-plans/${planId}/submissions`,
  )
  return data
}

export async function listReports(status?: string) {
  const { data } = await client.get<NurseReport[]>('/doctor/reports', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function reviewReport(reportId: number, doctorComment: string | null) {
  await client.post(`/doctor/reports/${reportId}/review`, { doctor_comment: doctorComment })
}
