/**
 * 全站顯示格式化與 enum → 中文標籤的唯一來源。
 * 後端 enum 新增值時記得同步這裡的 label 表，否則畫面會露出英文原值。
 */
import type { Role } from '@/types'

export const roleLabel: Record<Role, string> = {
  admin: '管理員',
  doctor: '醫師',
  nurse: '護理師',
  patient: '病患',
}

/** 姓名後綴角色，例：withRole('王大明','doctor') → '王大明 醫師'；空值回 '' */
export const withRole = (name: string | null | undefined, role: Role): string =>
  name ? `${name} ${roleLabel[role]}` : ''

/** ISO 日期字串 → YYYY/MM/DD；空值顯示破折號。 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return `${formatDate(value)} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function todayHeading(): string {
  const d = new Date()
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

/** 依當下時段回傳問候語（儀表板頁首用）。 */
export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早安'
  if (h < 14) return '午安'
  if (h < 18) return '午後好'
  return '晚安'
}

export const genderLabel: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
}

export const visitTypeLabel: Record<string, string> = {
  FIRST: '初診',
  FOLLOW_UP: '回診',
}

export const visitStatusLabel: Record<string, string> = {
  WAITING: '待看診',
  IN_CONSULTATION: '看診中',
  COMPLETED: '已完成',
}

export const rehabStatusLabel: Record<string, string> = {
  NO_PLAN: '無復健計畫',
  ONGOING: '進行中',
  PENDING_EVALUATION: '待評估',
  COMPLETED: '已完成',
  CLOSED: '已結案',
  CANCELLED: '已取消',
}

export const decisionLabel: Record<string, string> = {
  APPROVED: '通過',
  NEEDS_ATTENTION: '需注意',
}

export const reportKindLabel: Record<string, string> = {
  STATUS_REPORT: '狀況回報',
  ADJUSTMENT_SUGGESTION: '調整建議',
  ABNORMALITY: '異常回報',
}

export const reportStatusLabel: Record<string, string> = {
  PENDING_DOCTOR_REVIEW: '待醫師處理',
  REVIEWED: '已處理',
}

export const rehabDecisionLabel: Record<string, string> = {
  NO_REHAB: '不需要復健',
  CREATE_PLAN: '建立新的復健計畫',
  CONTINUE_PLAN: '持續目前復健計畫',
  ADJUST_PLAN: '調整目前復健計畫',
  END_PLAN: '結束目前復健計畫',
}

export const severityLabel: Record<string, string> = {
  NORMAL: '一般',
  PRIORITY: '優先',
  URGENT: '緊急',
}

/** 動作分數 → 色彩（高分綠、中間琥珀、低分赭紅） */
export function scoreColor(score: number): string {
  if (score >= 80) return '#8A9B6E'
  if (score >= 65) return '#D9A441'
  return '#B5543B'
}

/** 動作分數 → 等級文字 */
export function scoreGrade(score: number): string {
  if (score >= 85) return '優秀'
  if (score >= 72) return '良好'
  if (score >= 60) return '待加強'
  return '需指導'
}
