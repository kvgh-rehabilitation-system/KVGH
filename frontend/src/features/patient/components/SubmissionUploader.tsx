import { useEffect, useRef, useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import { getSubmissionProgress, uploadSubmission } from '../../../api/patient'
import type { AnalysisPipelineStatus, PlanItem } from '../../../types'
import { statusLabel } from '../../../utils/submissionStatus'

interface Props {
  planId: number
  item: PlanItem
  /** 分析完成/失敗後要求父層重抓計畫資料 */
  onFinished: () => void
}

/**
 * 病患端練習影片上傳：選檔 → 上傳 → 輪詢背景分析進度
 * （轉檔 → 2D/3D 萃取 → 與導師影片比對 → 產生分數）。
 */
export function SubmissionUploader({ planId, item, onFinished }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [trackingId, setTrackingId] = useState<number | null>(null)
  const [stage, setStage] = useState<AnalysisPipelineStatus | null>(null)

  // 導師影片必須「骨架已萃取＋動作已標註」才能比對評分，
  // 否則後端會拒收，這裡直接把按鈕鎖住並提示原因
  const teacherReady =
    item.teacher_video?.extraction_status === 'EXTRACTED' &&
    item.teacher_video?.annotation_status === 'ANNOTATED'

  // 上傳後每 4 秒輪詢分析進度（GPU 任務可能需要數分鐘）
  useEffect(() => {
    if (!trackingId) return
    const timer = setInterval(async () => {
      try {
        const p = await getSubmissionProgress(trackingId)
        setStage(p.analysis_status)
        if (p.analysis_status === 'DONE') {
          setTrackingId(null)
          toast.success(
            p.overall_score !== null
              ? `「${item.name}」分析完成：${Math.round(p.overall_score)} 分`
              : `「${item.name}」分析完成`,
          )
          onFinished()
        } else if (p.analysis_status === 'FAILED') {
          setTrackingId(null)
          toast.error(p.analysis_error ?? '影片分析失敗，請重新上傳')
          onFinished()
        }
      } catch {
        /* 輪詢失敗下次再試 */
      }
    }, 4000)
    return () => clearInterval(timer)
  }, [trackingId, item.name, onFinished])

  /**
   * 上傳選定影片並開始追蹤分析進度。
   * 成功後設定 trackingId 觸發上方輪詢 effect；失敗只 toast、不改追蹤狀態。
   */
  const upload = async (file: File) => {
    setUploading(true)
    try {
      const created = await uploadSubmission(planId, item.id, file)
      setTrackingId(created.id)
      setStage(created.analysis_status)
      toast.info('影片已上傳，AI 分析進行中，完成後會顯示分數')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploading(false)
      // 清空 input value，否則同一檔案重選不會觸發 onChange
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // 分析進行中：按鈕整個換成進度膠囊，避免病患對同一動作重複上傳
  if (trackingId && stage) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1.5 text-xs text-clay-600">
        <Loader2 size={13} className="animate-spin" /> {statusLabel(stage, 'patient')}
      </span>
    )
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
        }}
      />
      <button
        type="button"
        className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!teacherReady || uploading}
        title={teacherReady ? undefined : '護理師尚未完成此動作的導師影片與標註'}
        onClick={() => fileRef.current?.click()}
      >
        <UploadCloud size={14} />
        {uploading ? '上傳中…' : teacherReady ? '上傳練習影片' : '導師影片準備中'}
      </button>
    </>
  )
}
