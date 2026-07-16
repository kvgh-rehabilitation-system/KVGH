import { useEffect, useRef, useState } from 'react'
import {
  Clapperboard,
  FolderOpen,
  ListChecks,
  Loader2,
  RefreshCcw,
  Upload,
  User,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import { withRole } from '../../../utils/format'
import { getTeacherVideo, updatePlanItem, uploadTeacherVideo } from '../../../api/nurse'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import type { PlanItem, PlanItemTeacherVideo, TeacherVideo } from '../../../types'
import { TeacherVideoPickerDialog } from './TeacherVideoPickerDialog'

/** 後端 extraction_status → 處理階段文案（worker 管線：cpu 佇列轉檔 → gpu 佇列姿態萃取） */
const extractionLabel: Record<string, string> = {
  PENDING: '排隊等待處理',
  TRANSCODING: '影片轉檔中',
  EXTRACTING: '2D/3D 姿態萃取中（GPU）',
  EXTRACTED: '萃取完成',
  FAILED: '處理失敗',
}

interface Props {
  planId: number
  item: PlanItem
  /** 上傳/狀態變化後要求父層重抓 plan items */
  onChanged: () => void
}

/**
 * Plan item 的導師影片區塊：從影片庫選擇/切換，或直接上傳（需命名）→
 * 轉檔/萃取進度輪詢 → 標註入口。
 * 導師影片就緒（EXTRACTED + ANNOTATED）後，病患才能上傳該動作的練習影片。
 *
 * 綁定關係存在 plan item 的 teacher_video_id；同一支影片可被多個動作共用，
 * 所以「標註」是影片級屬性——改標註會影響所有引用該影片的動作。
 */
export function TeacherVideoCard({ planId, item, onChanged }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  // 本地維護一份導師影片狀態：輪詢時只更新這張卡，不必整頁重抓 plan items
  const [tv, setTv] = useState<PlanItemTeacherVideo | null>(item.teacher_video ?? null)
  const [uploading, setUploading] = useState(false)
  // 影片庫選擇對話框 / 直接上傳輸入列的開關
  const [pickerOpen, setPickerOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadName, setUploadName] = useState('')
  // 綁定/切換影片庫影片的請求進行中（避免連點）
  const [switching, setSwitching] = useState(false)

  // 父層重抓 plan items 後，以 props 的最新值覆蓋本地副本，兩邊保持同步
  useEffect(() => {
    setTv(item.teacher_video ?? null)
  }, [item.teacher_video])

  const processing =
    tv && ['PENDING', 'TRANSCODING', 'EXTRACTING'].includes(tv.extraction_status)

  // 轉檔/萃取進行中每 3 秒輪詢單支影片的最新狀態。
  // 注意：setTv 每次都建新物件 → tv 參考改變 → effect 重跑重設 interval，
  // 實際效果仍是每 3 秒一次，只是計時器每輪重建（無害）。
  // 萃取完成才呼叫 onChanged() 讓父層重抓（此時病患端解鎖條件可能改變）。
  useEffect(() => {
    if (!tv || !processing) return
    const timer = setInterval(async () => {
      try {
        const next = await getTeacherVideo(tv.id)
        // 完整 TeacherVideo → PlanItemTeacherVideo 的欄位裁剪（只留卡片需要的欄位）
        setTv({
          id: next.id,
          name: next.name,
          uploader_name: next.uploader_name,
          extraction_status: next.extraction_status,
          annotation_status: next.annotation_status,
          fps: next.fps,
          frame_count: next.frame_count,
          extraction_error: next.extraction_error,
        })
        if (next.extraction_status === 'EXTRACTED') {
          toast.success(`「${item.name}」導師影片萃取完成，請進行重點動作標註`)
          onChanged()
        } else if (next.extraction_status === 'FAILED') {
          toast.error(`「${item.name}」導師影片處理失敗`)
        }
      } catch {
        /* 輪詢失敗下次再試 */
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [tv, processing, item.name, onChanged])

  /**
   * 直接上傳導師影片並綁定到此動作（一步完成上傳 + 綁定，與影片庫獨立上傳不同）。
   *
   * 名稱必填：影片會同時進入共享影片庫，沒名稱日後無法辨識。
   * 成功後把回傳的影片設進本地狀態（PENDING 起跑），觸發上面的輪詢 effect。
   *
   * @param file 使用者選取的影片檔（mp4/mov）
   */
  const upload = async (file: File) => {
    const name = uploadName.trim()
    if (!name) {
      toast.error('請先輸入影片名稱，方便日後在影片庫辨識')
      return
    }
    setUploading(true)
    try {
      const created = await uploadTeacherVideo(planId, item.id, name, file)
      setTv({
        id: created.id,
        name: created.name,
        uploader_name: created.uploader_name,
        extraction_status: created.extraction_status,
        annotation_status: created.annotation_status,
        fps: created.fps,
        frame_count: created.frame_count,
        extraction_error: created.extraction_error,
      })
      setUploadOpen(false)
      setUploadName('')
      toast.info('導師影片已上傳，背景轉檔與姿態萃取中…')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploading(false)
      // 清空 file input 的值，否則重選同一個檔案不會觸發 onChange
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /**
   * 把影片庫中已萃取完成的影片綁定到此動作（寫 plan item 的 teacher_video_id）。
   *
   * 後端會再驗一次 extraction_status === 'EXTRACTED'，這裡失敗時 toast 即可。
   * 成功後交給 onChanged() 重抓 plan items → props 同步 effect 更新本地 tv，
   * 不在這裡手動 setTv，避免與父層資料出現兩份真相。
   *
   * @param video 影片庫對話框回傳的完整影片物件
   */
  const selectFromLibrary = async (video: TeacherVideo) => {
    setPickerOpen(false)
    setSwitching(true)
    try {
      await updatePlanItem(planId, item.id, { teacher_video_id: video.id })
      toast.success(
        `已選用「${video.name ?? video.original_filename ?? `影片 #${video.id}`}」`,
      )
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-sand bg-parchment/40 p-3">
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-bark-500">
          <Clapperboard size={13} /> 導師影片
        </span>

        {tv && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-bark-600">
            <span className="truncate font-medium">{tv.name ?? `影片 #${tv.id}`}</span>
            {tv.uploader_name && (
              <span className="inline-flex items-center gap-1 text-[11px] text-bark-300">
                <User size={11} /> {withRole(tv.uploader_name, 'nurse')}
              </span>
            )}
          </span>
        )}

        {/* 主狀態四分支：未綁定 → 處理中 → 失敗 → 已萃取（依標註狀態再細分）。
            每個分支提供對應的下一步操作（選擇/上傳/重試/標註/切換） */}
        {!tv ? (
          <>
            <span className="text-xs text-bark-300">
              尚未設定——病患需先有導師影片與標註才能上傳練習影片
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={switching}
              onClick={() => setPickerOpen(true)}
            >
              {switching ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FolderOpen size={13} />
              )}
              從影片庫選擇
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => setUploadOpen((v) => !v)}
            >
              <Upload size={13} /> 直接上傳
            </Button>
          </>
        ) : processing ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1 text-xs text-clay-600">
            <Loader2 size={12} className="animate-spin" />
            {extractionLabel[tv.extraction_status]}
          </span>
        ) : tv.extraction_status === 'FAILED' ? (
          <>
            <span className="rounded-full bg-[#FBF5F3] px-3 py-1 text-xs text-rust">
              處理失敗{tv.extraction_error ? `：${tv.extraction_error.slice(0, 80)}` : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => setUploadOpen((v) => !v)}
            >
              <RefreshCcw size={13} /> 重新上傳
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={switching}
              onClick={() => setPickerOpen(true)}
            >
              <FolderOpen size={13} /> 從影片庫選擇
            </Button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-sage-50 px-3 py-1 text-xs text-sage-700">
              萃取完成
            </span>
            {tv.annotation_status === 'ANNOTATED' ? (
              <span className="rounded-full bg-sage-50 px-3 py-1 text-xs text-sage-700">
                已標註，可接受病患影片
              </span>
            ) : tv.annotation_status === 'ANNOTATING' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1 text-xs text-clay-600">
                <Loader2 size={12} className="animate-spin" /> 標註處理中
              </span>
            ) : (
              <span className="rounded-full bg-[#FBF5F3] px-3 py-1 text-xs text-rust">
                待標註重點動作
              </span>
            )}
            <Link to={`/nurse/teacher-videos/${tv.id}/annotate`}>
              <Button variant="secondary" size="sm">
                <ListChecks size={13} />
                {tv.annotation_status === 'ANNOTATED' ? '重新標註' : '標註重點動作'}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              disabled={switching}
              onClick={() => setPickerOpen(true)}
            >
              {switching ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FolderOpen size={13} />
              )}
              從影片庫切換
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => setUploadOpen((v) => !v)}
            >
              <Upload size={13} /> 上傳更換
            </Button>
          </>
        )}
      </div>

      {/* 直接上傳輸入列：處理中隱藏，避免上傳到一半又疊一筆新上傳 */}
      {uploadOpen && !processing && (
        <div className="mt-2.5 flex items-center gap-2">
          <Input
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="影片名稱（必填），例如：深蹲示範（正面）"
            className="h-8 flex-1 text-xs"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => {
              if (!uploadName.trim()) {
                toast.error('請先輸入影片名稱，方便日後在影片庫辨識')
                return
              }
              fileRef.current?.click()
            }}
          >
            {uploading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Upload size={13} />
            )}
            {uploading ? '上傳中…' : '選擇檔案'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)}>
            <X size={13} />
          </Button>
        </div>
      )}

      <TeacherVideoPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={selectFromLibrary}
        currentId={tv?.id}
      />
    </div>
  )
}
