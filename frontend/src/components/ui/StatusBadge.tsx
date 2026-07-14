const palette: Record<string, string> = {
  // 看診狀態
  WAITING: 'bg-[#FBF3E2] text-[#A87A24]',
  IN_CONSULTATION: 'bg-clay-50 text-clay-600',
  // 計畫狀態
  ONGOING: 'bg-sage-50 text-sage-600',
  PENDING_EVALUATION: 'bg-[#FBF3E2] text-[#A87A24]',
  COMPLETED: 'bg-sage-50 text-sage-700',
  CLOSED: 'bg-parchment text-bark-400',
  CANCELLED: 'bg-parchment text-bark-300',
  NO_PLAN: 'bg-parchment text-bark-400',
  // 上傳 / 審核狀態
  ANALYZING: 'bg-clay-50 text-clay-600',
  PENDING_REVIEW: 'bg-[#FBF3E2] text-[#A87A24]',
  REVIEWED: 'bg-sage-50 text-sage-700',
  APPROVED: 'bg-sage-50 text-sage-700',
  NEEDS_ATTENTION: 'bg-[#F7E8E4] text-rust',
  // 回報
  STATUS_REPORT: 'bg-parchment text-bark-500',
  ADJUSTMENT_SUGGESTION: 'bg-clay-50 text-clay-600',
  ABNORMALITY: 'bg-[#F7E8E4] text-rust',
  PENDING_DOCTOR_REVIEW: 'bg-[#FBF3E2] text-[#A87A24]',
  // 嚴重度
  NORMAL: 'bg-parchment text-bark-400',
  PRIORITY: 'bg-[#FBF3E2] text-[#A87A24]',
  URGENT: 'bg-[#F7E8E4] text-rust',
  // 看診類型
  FIRST: 'bg-clay-50 text-clay-600',
  FOLLOW_UP: 'bg-parchment text-bark-500',
  // 分析 pipeline（admin 任務監控）
  PENDING: 'bg-parchment text-bark-400',
  TRANSCODING: 'bg-clay-50 text-clay-600',
  EXTRACTING: 'bg-clay-50 text-clay-600',
  COMPARING: 'bg-clay-50 text-clay-600',
  DONE: 'bg-sage-50 text-sage-700',
  FAILED: 'bg-[#F7E8E4] text-rust',
  // 帳號啟用狀態（admin 帳號管理）
  ACTIVE: 'bg-sage-50 text-sage-600',
  DISABLED: 'bg-parchment text-bark-300',
}

/** 需要呼吸圓點的狀態（等待中的事） */
const pulseDot: Record<string, string> = {
  PENDING_REVIEW: 'bg-[#A87A24]',
  ANALYZING: 'bg-clay-500',
  PENDING_DOCTOR_REVIEW: 'bg-[#A87A24]',
  WAITING: 'bg-[#A87A24]',
  TRANSCODING: 'bg-clay-500',
  EXTRACTING: 'bg-clay-500',
  COMPARING: 'bg-clay-500',
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  const dot = pulseDot[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
        palette[status] ?? 'bg-parchment text-bark-400'
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full animate-breathe ${dot}`} />}
      {label}
    </span>
  )
}
