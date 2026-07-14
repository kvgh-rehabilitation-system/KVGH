import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clapperboard, Loader2, Upload, User } from 'lucide-react'
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
import { formatDate, withRole } from '../../../utils/format'

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

  // 優先顯示目前綁定影片；沒有綁定時顯示第一支可選用影片。
  useEffect(() => {
    if (!open || !videos) return
    setPreviewId((selectedId) => {
      const selectedStillAvailable = videos.some(
        (video) => video.id === selectedId && video.extraction_status === 'EXTRACTED',
      )
      if (selectedStillAvailable) return selectedId

      const current = videos.find(
        (video) => video.id === currentId && video.extraction_status === 'EXTRACTED',
      )
      return current?.id ?? videos.find((video) => video.extraction_status === 'EXTRACTED')?.id ?? null
    })
  }, [open, videos, currentId])

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

  const previewVideo = videos?.find((video) => video.id === previewId) ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[90dvh] max-h-[52rem] w-[94vw] max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)] gap-0 overflow-hidden bg-cream p-0">
        <DialogHeader className="border-b border-sand/80 bg-white px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-16">
          <DialogTitle>導師影片庫</DialogTitle>
          <DialogDescription>
            所有醫護人員上傳的示範影片共用一個影片庫；已完成萃取的影片可直接選用。
          </DialogDescription>
        </DialogHeader>

        {/* 上傳新影片 */}
        <div className="border-b border-sand/80 bg-parchment/40 px-4 py-3 sm:px-6">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className="shrink-0 text-xs font-medium text-bark-500">上傳新影片（名稱必填）</p>
            <Input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="影片名稱，例如：深蹲示範（正面）"
              className="h-9 min-w-0 flex-1"
            />
            <Button
              variant="secondary"
              disabled={uploading}
              size="sm"
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

        <div className="grid min-h-0 grid-rows-[minmax(13rem,40dvh)_minmax(0,1fr)] lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.5fr)] lg:grid-rows-1">
          {/* 影片清單 */}
          <div className="order-2 min-h-0 overflow-y-auto border-t border-sand/80 bg-white p-3 sm:p-4 lg:order-1 lg:border-r lg:border-t-0">
            {!videos ? (
              <Loading />
            ) : videos.length === 0 ? (
              <EmptyState message="影片庫還是空的" hint="上傳第一支導師示範影片吧" />
            ) : (
              <div className="space-y-2">
                {videos.map((v) => {
                  const processing = ['PENDING', 'TRANSCODING', 'EXTRACTING'].includes(
                    v.extraction_status,
                  )
                  const selectable = v.extraction_status === 'EXTRACTED'
                  const isCurrent = currentId != null && v.id === currentId
                  const previewing = previewId === v.id
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center gap-2 rounded-xl border transition-colors ${
                        previewing
                          ? 'border-clay-400 bg-clay-50/70 shadow-sm'
                          : isCurrent
                            ? 'border-clay-200 bg-clay-50/30'
                            : 'border-sand bg-white hover:border-clay-200'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!selectable}
                        onClick={() => setPreviewId(v.id)}
                        className="min-w-0 flex-1 px-3 py-3 text-left disabled:cursor-default"
                      >
                        <p className="truncate text-sm font-medium text-bark-700">
                          {v.name ?? v.original_filename ?? `影片 #${v.id}`}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-bark-300">
                          <span className="inline-flex items-center gap-1">
                            <User size={11} /> {v.uploader_name ? withRole(v.uploader_name, 'nurse') : '—'}
                          </span>
                          <span>{formatDate(v.created_at)}</span>
                        </p>
                        <span className="mt-2 inline-flex">
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
                              {v.annotation_status === 'ANNOTATED'
                                ? '已標註'
                                : '未標註重點動作'}
                            </span>
                          )}
                        </span>
                      </button>

                      <div className="shrink-0 pr-3">
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 大尺寸影片預覽 */}
          <div className="order-1 grid min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-bark-800 lg:order-2">
            <div className="border-b border-white/10 px-4 py-3 sm:px-5">
              <p className="truncate text-sm font-medium text-white">
                {previewVideo
                  ? (previewVideo.name ??
                    previewVideo.original_filename ??
                    `影片 #${previewVideo.id}`)
                  : '影片預覽'}
              </p>
              <p className="mt-0.5 text-xs text-white/55">
                {previewVideo ? '完整比例顯示，不裁切影片內容' : '請從清單選擇已完成萃取的影片'}
              </p>
            </div>

            <div className="flex min-h-0 items-center justify-center p-2 sm:p-4">
              <AnimatePresence mode="wait" initial={false}>
                {previewVideo ? (
                  <motion.div
                    key={previewVideo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="h-full w-full"
                  >
                    <VideoPlayer
                      src={teacherVideoUrl(previewVideo.id)}
                      title={previewVideo.name ?? undefined}
                      aspect="auto"
                      className="flex h-full w-full items-center justify-center rounded-xl border-white/10"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2 text-center text-white/45"
                  >
                    <Clapperboard size={30} strokeWidth={1.5} />
                    <span className="text-sm">沒有可預覽的影片</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
