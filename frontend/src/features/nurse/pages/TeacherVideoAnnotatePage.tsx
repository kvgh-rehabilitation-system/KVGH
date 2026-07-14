import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import { teacherVideoUrl } from '../../../api/media'
import { getAnnotation, getTeacherVideo, submitAnnotation } from '../../../api/nurse'
import { Button } from '../../../components/ui/button'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { TeacherVideo } from '../../../types'

/**
 * 導師影片重點動作標註頁。
 *
 * 護理師逐幀檢視導師影片，標記演算法要評分的重點動作幀
 * （例如深蹲的蹲底、起立）。送出後由背景 worker 產生演算法標註 JSON。
 */
export function TeacherVideoAnnotatePage() {
  const { teacherVideoId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [video, setVideo] = useState<TeacherVideo | null>(null)
  const [frame, setFrame] = useState(0)
  const [marked, setMarked] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [waitingSaved, setWaitingSaved] = useState(false)

  const fps = video?.fps ?? 30
  const frameCount = video?.frame_count ?? 0
  const lastFrame = Math.max(0, frameCount - 1)

  useEffect(() => {
    if (!teacherVideoId) return
    Promise.all([getTeacherVideo(teacherVideoId), getAnnotation(teacherVideoId)])
      .then(([tv, ann]) => {
        setVideo(tv)
        setMarked(ann.frames)
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
  }, [teacherVideoId])

  // 標註完成的輪詢（worker 在背景寫演算法 JSON）
  useEffect(() => {
    if (!waitingSaved || !teacherVideoId) return
    const timer = setInterval(async () => {
      const tv = await getTeacherVideo(teacherVideoId)
      setVideo(tv)
      if (tv.annotation_status === 'ANNOTATED') {
        setWaitingSaved(false)
        toast.success('標註已完成，此動作可開始接受病患影片')
      } else if (tv.annotation_status === 'UNANNOTATED') {
        setWaitingSaved(false)
        toast.error(tv.extraction_error ?? '標註處理失敗，請重試')
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [waitingSaved, teacherVideoId])

  const seekTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(lastFrame, next))
      setFrame(clamped)
      const el = videoRef.current
      // +0.5 幀避免落在幀邊界時瀏覽器取到前一幀
      if (el) el.currentTime = (clamped + 0.5) / fps
    },
    [fps, lastFrame],
  )

  const toggleMark = useCallback(() => {
    setMarked((prev) =>
      prev.includes(frame)
        ? prev.filter((f) => f !== frame)
        : [...prev, frame].sort((a, b) => a - b),
    )
  }, [frame])

  // 鍵盤操作：←→ 逐幀、Shift+←→ 十幀、S 標記
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') seekTo(frame - (e.shiftKey ? 10 : 1))
      else if (e.key === 'ArrowRight') seekTo(frame + (e.shiftKey ? 10 : 1))
      else if (e.key.toLowerCase() === 's') toggleMark()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frame, seekTo, toggleMark])

  const save = async () => {
    if (!teacherVideoId) return
    if (marked.length === 0) {
      toast.error('請至少標註一個重點動作幀')
      return
    }
    setSaving(true)
    try {
      await submitAnnotation(teacherVideoId, marked)
      setWaitingSaved(true)
      toast.info('標註已送出，背景處理中…')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const streamUrl = useMemo(
    () => (teacherVideoId ? teacherVideoUrl(Number(teacherVideoId)) : ''),
    [teacherVideoId],
  )

  if (!video) return <Loading />

  if (video.extraction_status !== 'EXTRACTED') {
    return (
      <PageTransition>
        <div className="card mx-auto max-w-xl p-8 text-center text-sm text-bark-500">
          導師影片尚未完成 2D/3D 萃取（目前狀態：{video.extraction_status}），
          完成後才能標註重點動作。
        </div>
      </PageTransition>
    )
  }

  const annotated = video.annotation_status === 'ANNOTATED'

  return (
    <PageTransition>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回
      </button>

      <div className="mx-auto max-w-6xl space-y-5">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-bark-700">
                標註重點動作
              </h1>
              <p className="mt-1 text-sm text-bark-400">
                {video.original_filename ?? `導師影片 #${video.id}`}・
                {frameCount} 幀・{fps.toFixed(0)} fps
              </p>
            </div>
            <StatusBadge
              status={annotated ? 'APPROVED' : 'ANALYZING'}
              label={
                annotated ? '已完成標註' : waitingSaved ? '標註處理中…' : '未完成標註'
              }
            />
          </div>
          <p className="mt-3 rounded-xl bg-parchment/70 p-3 text-xs leading-relaxed text-bark-500">
            用逐幀按鈕或鍵盤（← → 逐幀、Shift 加速、S 標記）找到動作的關鍵時刻
            （如深蹲的蹲底與站起），演算法會以這些幀為評分基準比對病患影片。
          </p>
        </div>

        {/* 左：影片與時間軸；右：逐幀工具與已標記清單 */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="card overflow-hidden p-0">
            <video
              ref={videoRef}
              src={streamUrl}
              playsInline
              preload="auto"
              className="mx-auto max-h-[62vh] w-full bg-black object-contain"
              onLoadedMetadata={() => seekTo(0)}
            />
            <div className="p-5">
              {/* 幀滑桿：已標註的幀顯示刻度 */}
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={lastFrame}
                  value={frame}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  className="w-full accent-clay-500"
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-2">
                  {marked.map((f) => (
                    <span
                      key={f}
                      className="absolute top-[3px] h-3 w-1 -translate-x-1/2 rounded-full bg-sage-500"
                      style={{ left: `${lastFrame ? (f / lastFrame) * 100 : 0}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="card space-y-4 p-5">
              <p className="text-center text-sm tabular-nums text-bark-600">
                第 <strong className="text-base">{frame}</strong> / {lastFrame} 幀
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => seekTo(frame - 10)}>
                  <ChevronsLeft size={15} /> 10
                </Button>
                <Button variant="ghost" size="sm" onClick={() => seekTo(frame - 1)}>
                  <ChevronLeft size={15} /> 1
                </Button>
                <Button variant="ghost" size="sm" onClick={() => seekTo(frame + 1)}>
                  1 <ChevronRight size={15} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => seekTo(frame + 10)}>
                  10 <ChevronsRight size={15} />
                </Button>
              </div>
              <Button
                onClick={toggleMark}
                variant={marked.includes(frame) ? 'secondary' : 'default'}
                className="w-full"
              >
                <Bookmark size={15} />
                {marked.includes(frame) ? '取消標記此幀' : '標記此幀（S）'}
              </Button>
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-bark-600">
                  已標記 {marked.length} 個重點動作幀
                </h2>
                <Button
                  size="sm"
                  onClick={save}
                  disabled={saving || waitingSaved || marked.length === 0}
                >
                  <Check size={15} />
                  {saving ? '送出中…' : waitingSaved ? '背景處理中…' : '送出標註'}
                </Button>
              </div>
              {marked.length === 0 ? (
                <p className="text-xs text-bark-300">尚未標記任何幀</p>
              ) : (
                <ul className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
                  {marked.map((f, i) => (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex w-full items-center gap-1.5 rounded-full bg-sage-50 px-3 py-1.5 text-xs text-sage-700"
                    >
                      <button className="hover:underline" onClick={() => seekTo(f)}>
                        動作 {i + 1}・第 {f} 幀
                      </button>
                      <button
                        onClick={() => setMarked((prev) => prev.filter((x) => x !== f))}
                        className="text-sage-400 hover:text-rust"
                        aria-label="移除"
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
