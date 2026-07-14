import type { DisplayStatus } from '../types'

/**
 * 影片分析狀態文案的唯一來源。
 * `display_status` 由後端預算（common.submission_display_status）：
 * FAILED > 管線階段（分析中）> 業務狀態，前端不再自行組合兩欄位。
 */

/** 醫護 / 管理員版（顯示管線階段） */
export const displayStatusLabel: Record<DisplayStatus, string> = {
  PENDING: '排隊等待分析',
  TRANSCODING: '影片轉檔中',
  EXTRACTING: '2D/3D 姿態萃取中',
  COMPARING: '與導師影片比對中',
  DONE: '分析完成',
  FAILED: '分析失敗',
  PENDING_REVIEW: '待審核',
  REVIEWED: '已審核',
}

/** 病患版（白話，管線細節收斂為「AI 分析中」） */
export const patientDisplayStatusLabel: Record<DisplayStatus, string> = {
  PENDING: '排隊等待分析中',
  TRANSCODING: 'AI 分析中',
  EXTRACTING: 'AI 分析中',
  COMPARING: 'AI 分析中',
  DONE: '分析完成',
  FAILED: '分析失敗',
  PENDING_REVIEW: '等待護理師回饋',
  REVIEWED: '護理師已回覆',
}

/** 清單 tab / 篩選用的業務狀態聚合標籤（ANALYZING 聚合全部管線階段） */
export const submissionStatusFilterLabel: Record<string, string> = {
  ALL: '全部',
  ANALYZING: '分析中',
  PENDING_REVIEW: '待審核',
  REVIEWED: '已審核',
}

/** 演算法處理中的顯示狀態（輪詢條件用） */
export const PIPELINE_ACTIVE_STATUSES: readonly DisplayStatus[] = [
  'PENDING',
  'TRANSCODING',
  'EXTRACTING',
  'COMPARING',
]

export function isPipelineActive(status: string): boolean {
  return (PIPELINE_ACTIVE_STATUSES as readonly string[]).includes(status)
}

/** 取狀態文案，未知值 fallback 顯示原始字串 */
export function statusLabel(status: string, audience: 'patient' | 'staff' = 'staff'): string {
  const map = audience === 'patient' ? patientDisplayStatusLabel : displayStatusLabel
  return map[status as DisplayStatus] ?? status
}
