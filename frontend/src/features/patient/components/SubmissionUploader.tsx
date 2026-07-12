import { useEffect, useRef, useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import { getSubmissionProgress, uploadSubmission } from '../../../api/patient'
import type { AnalysisPipelineStatus, PlanItem } from '../../../types'

const stageLabel: Record<AnalysisPipelineStatus, string> = {
  PENDING: '排隊等待分析',
  TRANSCODING: '影片轉檔中',
  EXTRACTING: 'AI 姿態分析中',
  COMPARING: '與導師影片比對中',
  DONE: '分析完成',
  FAILED: '分析失敗',
}

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
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (trackingId && stage) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1.5 text-xs text-clay-600">
        <Loader2 size={13} className="animate-spin" /> {stageLabel[stage]}
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
