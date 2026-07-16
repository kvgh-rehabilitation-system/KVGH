import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { analysisVideoUrl, submissionVideoUrl, teacherVideoUrl } from '../../../../api/media'
import { VideoPlaceholder } from '../../../../components/ui/VideoPlaceholder'
import { VideoPlayer } from '../../../../components/ui/VideoPlayer'
import type { ActionCard, CurvePoint, SubmissionDetail } from '../../../../types'

/** 三種比對畫面：plain=2×2 對齊重播、full=演算法完整輸出、raw=原始影片並排 */
type Variant = 'plain' | 'full' | 'raw'

/** 供父頁面經 ref 呼叫的跳轉介面（ActionBreakdown / SimilarityTimeline 點擊時觸發） */
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

/**
 * 把影片跳到指定秒數並自動播放。
 *
 * 上限箝到 duration - 0.05：跳到最尾端會直接觸發 ended 停格，留一點餘裕
 * 讓使用者至少看得到該幀。metadata 未載入（duration 為 NaN）時直接用 t，
 * 交給瀏覽器自行箝制。play() 可能因瀏覽器自動播放政策被拒，靜默忽略。
 *
 * @param t 目標秒數（必須是該影片自己時間軸上的秒數）
 */
function seekVideo(video: HTMLVideoElement | null, t: number) {
  if (!video) return
  const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration - 0.05 : t
  video.currentTime = Math.max(0, Math.min(t, max))
  video.play().catch(() => {})
}

/**
 * 比對影片面板（seek 中樞）：三種畫面切換，動作卡／時間軸的跳轉
 * 依當前畫面取用後端預算好的對應秒數（各影片時間軸不同，不可混用）。
 *
 * ⚠️ 時間軸陷阱：病患原片 ≈60fps；output.mp4 / output_plain.mp4 是演算法以
 * 30fps 寫死合成（每步驟寫 max(Δ導師幀, Δ病患幀) 幀、完整版每步驟再停 60 幀），
 * 所以四條時間軸互不相通。跳轉一律用後端 analysis_data_service 預算好的
 * t_plain / t_full / t_patient / t_mentor，前端絕不可自行由幀數換算秒數。
 */
export const ComparisonVideoPanel = forwardRef<ComparisonVideoHandle, Props>(
  function ComparisonVideoPanel({ data, hasAnalysisData }, ref) {
    // 分析產物就緒才提供 2×2 / 完整版；seed 假資料或分析中只有原始影片可看
    const analysisReady = hasAnalysisData && data.analysis_status === 'DONE'
    const [variant, setVariant] = useState<Variant>(analysisReady ? 'plain' : 'raw')
    // mainRef 給單一畫面（plain/full）；raw 並排時病患/導師各一個 ref
    const mainRef = useRef<HTMLVideoElement>(null)
    const patientRef = useRef<HTMLVideoElement>(null)
    const teacherRef = useRef<HTMLVideoElement>(null)

    // 依「當前畫面」挑對應時間軸的秒數跳轉；raw 並排時病患與導師各跳各的
    // （t_mentor 可能為 null：該步驟病患幀數較多、導師端已凍結時無對應點）
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

    // 無分析資料時只留 raw 選項（切換列會因 options.length === 1 而整個隱藏）
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
                {/* 動作未綁定導師影片時（舊資料/seed），退回顯示外部範例影片連結占位 */}
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
              // key 讓切換 plain/full 時整個 <video> 重建，避免沿用上一部影片的播放狀態
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
