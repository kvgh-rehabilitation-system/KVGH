import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { analysisVideoUrl, submissionVideoUrl, teacherVideoUrl } from '../../../../api/media'
import { VideoPlaceholder } from '../../../../components/ui/VideoPlaceholder'
import { VideoPlayer } from '../../../../components/ui/VideoPlayer'
import type { ActionCard, CurvePoint, SubmissionDetail } from '../../../../types'

type Variant = 'plain' | 'full' | 'raw'

export interface ComparisonVideoHandle {
  seekAction(action: ActionCard): void
  seekCurvePoint(point: CurvePoint): void
}

interface Props {
  data: SubmissionDetail
  /** 有比對明細（analysis-data 有回應）才提供 2×2 / 完整版選項 */
  hasAnalysisData: boolean
}

const VARIANT_OPTIONS: { key: Variant; label: string; hint: string }[] = [
  { key: 'plain', label: '2×2 比對', hint: '導師與病患的 2D／3D 對齊重播' },
  { key: 'full', label: '完整分析畫面', hint: '演算法原始輸出（含 ALPS／TALMA 圖表）' },
  { key: 'raw', label: '原始影片並排', hint: '導師示範與病患上傳的原始影片' },
]

function seekVideo(video: HTMLVideoElement | null, t: number) {
  if (!video) return
  const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration - 0.05 : t
  video.currentTime = Math.max(0, Math.min(t, max))
  video.play().catch(() => {})
}

/**
 * 比對影片面板（seek 中樞）：三種畫面切換，動作卡／時間軸的跳轉
 * 依當前畫面取用後端預算好的對應秒數（各影片時間軸不同，不可混用）。
 */
export const ComparisonVideoPanel = forwardRef<ComparisonVideoHandle, Props>(
  function ComparisonVideoPanel({ data, hasAnalysisData }, ref) {
    const analysisReady = hasAnalysisData && data.analysis_status === 'DONE'
    const [variant, setVariant] = useState<Variant>(analysisReady ? 'plain' : 'raw')
    const mainRef = useRef<HTMLVideoElement>(null)
    const patientRef = useRef<HTMLVideoElement>(null)
    const teacherRef = useRef<HTMLVideoElement>(null)

    useImperativeHandle(ref, () => ({
      seekAction(a: ActionCard) {
        if (variant === 'plain') seekVideo(mainRef.current, a.t_plain)
        else if (variant === 'full') seekVideo(mainRef.current, a.t_full)
        else {
          seekVideo(patientRef.current, a.t_patient)
          if (a.t_mentor != null) seekVideo(teacherRef.current, a.t_mentor)
        }
      },
      seekCurvePoint(p: CurvePoint) {
        if (variant === 'plain') seekVideo(mainRef.current, p.t_plain)
        else if (variant === 'full') seekVideo(mainRef.current, p.t_full)
        else seekVideo(patientRef.current, p.t_patient)
      },
    }))

    const options = analysisReady ? VARIANT_OPTIONS : VARIANT_OPTIONS.filter((o) => o.key === 'raw')
    const active = VARIANT_OPTIONS.find((o) => o.key === variant)!

    return (
      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-bark-600">
            比對影片
            <span className="ml-2 text-xs font-normal text-bark-300">{active.hint}</span>
          </h3>
          {options.length > 1 && (
            <div className="flex rounded-full border border-sand bg-parchment/60 p-0.5">
              {options.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setVariant(o.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs transition-all ${
                    variant === o.key
                      ? 'bg-white font-medium text-clay-600 shadow-soft'
                      : 'text-bark-400 hover:text-bark-600'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 三種畫面統一顯示高度，寬度隨各影片原生比例自動伸縮（上傳影片尺寸不可預期） */}
        <div className="h-[min(60vh,560px)]">
          {variant === 'raw' ? (
            <div className="flex h-full items-stretch justify-center gap-4">
              <div className="relative h-full min-w-0">
                {data.item.teacher_video_id ? (
                  <VideoPlayer
                    videoRef={teacherRef}
                    src={teacherVideoUrl(data.item.teacher_video_id)}
                    title={`導師示範・${data.item.name}`}
                    aspect="fill-height"
                  />
                ) : (
                  <VideoPlaceholder
                    title={`範例示範・${data.item.name}`}
                    subtitle={data.item.example_video_note ?? undefined}
                    videoUrl={data.item.example_video_url}
                    className="h-full"
                  />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white">
                  導師示範影片
                </span>
              </div>
              <div className="relative h-full min-w-0">
                <VideoPlayer
                  videoRef={patientRef}
                  src={submissionVideoUrl(data.id)}
                  title={`${data.patient_name}・${data.item.name}`}
                  aspect="fill-height"
                />
                <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white">
                  病患上傳影片
                </span>
              </div>
            </div>
          ) : (
            <VideoPlayer
              key={variant}
              videoRef={mainRef}
              src={analysisVideoUrl(data.id, variant)}
              title={`比對影片・${data.item.name}`}
              aspect="fill-height"
              onError={() => {
                // 舊資料可能沒有 2×2 版本 → 自動退回完整版
                if (variant === 'plain') setVariant('full')
              }}
            />
          )}
        </div>
      </section>
    )
  },
)
