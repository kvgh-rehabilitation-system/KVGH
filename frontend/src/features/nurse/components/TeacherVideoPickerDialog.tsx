import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Eye, EyeOff, Loader2, Upload, User } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import { createTeacherVideo, listTeacherVideos } from '../../../api/nurse'
import { teacherVideoUrl } from '../../../api/media'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Input } from '../../../components/ui/input'
import { Loading } from '../../../components/ui/Loading'
import { VideoPlayer } from '../../../components/ui/VideoPlayer'
import type { TeacherVideo } from '../../../types'
import { formatDate } from '../../../utils/format'

const extractionLabel: Record<string, string> = {
  PENDING: '排隊等待處理',
  TRANSCODING: '影片轉檔中',
  EXTRACTING: '姿態萃取中',
  EXTRACTED: '萃取完成',
  FAILED: '處理失敗',
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 選定影片庫中已完成萃取的影片 */
  onSelect: (tv: TeacherVideo) => void
  /** 目前動作已綁定的影片 id（顯示「使用中」） */
  currentId?: number | null
}

/**
 * 導師影片庫：跨護理師共享的影片清單，可預覽、選用（限已完成萃取），
 * 也可直接上傳新影片（需命名）進影片庫。
 */
export function TeacherVideoPickerDialog({ open, onOpenChange, onSelect, currentId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [videos, setVideos] = useState<TeacherVideo[] | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploading, setUploading] = useState(false)

  const refresh = useCallback(() => {
    listTeacherVideos()
      .then(setVideos)
      .catch((err) => toast.error(apiErrorMessage(err)))
  }, [])

  useEffect(() => {
    if (open) {
      setVideos(null)
      setPreviewId(null)
      refresh()
    }
  }, [open, refresh])

  // 有影片處理中時每 3 秒更新清單狀態
  const hasProcessing = videos?.some((v) =>
    ['PENDING', 'TRANSCODING', 'EXTRACTING'].includes(v.extraction_status),
  )
  useEffect(() => {
    if (!open || !hasProcessing) return
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [open, hasProcessing, refresh])

  const upload = async (file: File) => {
    const name = uploadName.trim()
    if (!name) {
      toast.error('請先輸入影片名稱，方便日後在影片庫辨識')
      return
    }
    setUploading(true)
    try {
      await createTeacherVideo(name, file)
      setUploadName('')
      toast.info('影片已上傳進影片庫，背景轉檔與姿態萃取中…')
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>導師影片庫</DialogTitle>
          <DialogDescription>
            所有醫護人員上傳的示範影片共用一個影片庫；已完成萃取的影片可直接選用。
          </DialogDescription>
        </DialogHeader>

        {/* 上傳新影片 */}
        <div className="rounded-xl border border-dashed border-sand bg-parchment/40 p-3.5">
          <p className="mb-2.5 text-xs font-medium text-bark-500">上傳新影片（名稱必填）</p>
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
          <div className="flex gap-2.5">
            <Input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="影片名稱，例如：深蹲示範（正面）"
              className="flex-1"
            />
            <Button
              variant="secondary"
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
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              {uploading ? '上傳中…' : '選擇檔案上傳'}
            </Button>
          </div>
        </div>

        {/* 影片清單 */}
        <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {!videos ? (
            <Loading />
          ) : videos.length === 0 ? (
            <EmptyState message="影片庫還是空的" hint="上傳第一支導師示範影片吧" />
          ) : (
            videos.map((v) => {
              const processing = ['PENDING', 'TRANSCODING', 'EXTRACTING'].includes(
                v.extraction_status,
              )
              const selectable = v.extraction_status === 'EXTRACTED'
              const isCurrent = currentId != null && v.id === currentId
              const previewing = previewId === v.id
              return (
                <div
                  key={v.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    isCurrent ? 'border-clay-300 bg-clay-50/50' : 'border-sand bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-bark-700">
                        {v.name ?? v.original_filename ?? `影片 #${v.id}`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-bark-300">
                        <span className="inline-flex items-center gap-1">
                          <User size={11} /> {v.uploader_name ?? '—'}
                        </span>
                        <span>{formatDate(v.created_at)}</span>
                      </p>
                    </div>

                    {processing ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-2.5 py-1 text-[11px] text-clay-600">
                        <Loader2 size={11} className="animate-spin" />
                        {extractionLabel[v.extraction_status]}
                      </span>
                    ) : v.extraction_status === 'FAILED' ? (
                      <span className="rounded-full bg-[#FBF5F3] px-2.5 py-1 text-[11px] text-rust">
                        處理失敗
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] ${
                          v.annotation_status === 'ANNOTATED'
                            ? 'bg-sage-50 text-sage-700'
                            : 'bg-[#FBF3E2] text-[#A87A24]'
                        }`}
                      >
                        {v.annotation_status === 'ANNOTATED' ? '已標註' : '未標註重點動作'}
                      </span>
                    )}

                    {selectable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewId(previewing ? null : v.id)}
                      >
                        {previewing ? <EyeOff size={13} /> : <Eye size={13} />}
                        {previewing ? '收合' : '預覽'}
                      </Button>
                    )}
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-clay-500 px-2.5 py-1 text-[11px] font-medium text-white">
                        <Check size={11} /> 使用中
                      </span>
                    ) : (
                      <Button size="sm" disabled={!selectable} onClick={() => onSelect(v)}>
                        選用
                      </Button>
                    )}
                  </div>

                  <AnimatePresence>
                    {previewing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 h-[300px]">
                          <VideoPlayer
                            src={teacherVideoUrl(v.id)}
                            title={v.name ?? undefined}
                            aspect="fill-height"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
