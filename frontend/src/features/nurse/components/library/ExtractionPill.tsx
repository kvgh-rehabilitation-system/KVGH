import { Loader2 } from 'lucide-react'
import type { TeacherVideo } from '../../../../types'
import { PROCESSING_STATUSES } from './extractionStatus'

/** 後端 extraction_status → 處理階段文案（worker 管線：轉檔 → 姿態萃取） */
const extractionLabel: Record<string, string> = {
  PENDING: '排隊等待處理',
  TRANSCODING: '影片轉檔中',
  EXTRACTING: '姿態萃取中',
  EXTRACTED: '萃取完成',
  FAILED: '處理失敗',
}

/**
 * 導師影片的轉檔/萃取/標註狀態 pill（樣式同影片庫選片彈窗）。
 * 三分支：處理中（轉圈）> 失敗（hover 顯示錯誤原文）> 已萃取（依標註狀態分色，
 * 因為萃取完成後護理師下一步關心的是「標註好了沒」）。
 */
export function ExtractionPill({ video }: { video: TeacherVideo }) {
  if (PROCESSING_STATUSES.includes(video.extraction_status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-2.5 py-1 text-[11px] text-clay-600">
        <Loader2 size={11} className="animate-spin" />
        {extractionLabel[video.extraction_status]}
      </span>
    )
  }
  if (video.extraction_status === 'FAILED') {
    return (
      <span
        className="rounded-full bg-[#FBF5F3] px-2.5 py-1 text-[11px] text-rust"
        title={video.extraction_error ?? undefined}
      >
        處理失敗
      </span>
    )
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] ${
        video.annotation_status === 'ANNOTATED'
          ? 'bg-sage-50 text-sage-700'
          : 'bg-[#FBF3E2] text-[#A87A24]'
      }`}
    >
      {video.annotation_status === 'ANNOTATED' ? '已標註' : '未標註重點動作'}
    </span>
  )
}
