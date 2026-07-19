import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { teacherVideoUrl } from '../../../api/media'
import { getPlan } from '../../../api/patient'
import { CompletionTrendChart } from '../../../components/ui/CompletionTrendChart'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { ProgressRing } from '../../../components/ui/ProgressRing'
import { ScoreTrendChart } from '../../../components/ui/ScoreTrendChart'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { VideoPlaceholder } from '../../../components/ui/VideoPlaceholder'
import { VideoPlayer } from '../../../components/ui/VideoPlayer'
import { usePollingReload } from '../../../hooks/usePollingReload'
import type { PortalPlanDetail } from '../../../types'
import { decisionLabel, formatDate, formatDateTime, rehabStatusLabel, scoreColor, withRole } from '../../../utils/format'
import { isPipelineActive, statusLabel } from '../../../utils/submissionStatus'
import { SubmissionUploader } from '../components/SubmissionUploader'

/**
 * 病患端計畫詳情頁：計畫核心操作頁——看導師示範影片、上傳練習影片、
 * 追蹤分數趨勢與護理師回饋。上傳後靠輪詢自動更新分析結果。
 */
export function PortalPlanDetailPage() {
  const { planId } = useParams()
  const [plan, setPlan] = useState<PortalPlanDetail | null>(null)

  // reload 以 useCallback 固定住，供 usePollingReload 與 SubmissionUploader.onFinished 共用；
  // 直接覆寫 setPlan、不先清空，避免輪詢刷新時畫面閃一下 Loading
  const reload = useCallback(() => {
    if (planId) getPlan(planId).then(setPlan)
  }, [planId])

  useEffect(() => {
    reload()
  }, [reload])

  // 有影片還在演算法管線時輪詢，分析完成自動更新
  usePollingReload(
    reload,
    !!plan && plan.submissions.some((s) => isPipelineActive(s.display_status)),
  )

  if (!plan) return <Loading />

  return (
    <PageTransition testId="patient-plan-detail">
      <Link to="/portal/rehabilitation-plans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 hover:text-clay-600">
        <ArrowLeft size={15} /> 返回復健計畫
      </Link>

      <header className="card mb-6 flex flex-wrap items-center gap-6 p-6 lg:p-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-bark-700">{plan.name}</h1>
            <StatusBadge status={plan.status} label={rehabStatusLabel[plan.status] ?? plan.status} />
          </div>
          <p className="mt-2 text-sm text-bark-400">
            {formatDate(plan.start_date)} 開始
            {plan.evaluation_date && ` · 預計評估 ${formatDate(plan.evaluation_date)}`}
          </p>
          <p className="mt-1 text-sm text-bark-400">主治醫師：{plan.doctor_name}{plan.nurse_name && ` · 負責護理師：${plan.nurse_name}`}</p>
        </div>
        <div className="text-center">
          <ProgressRing progress={Math.round(plan.week_completion_rate * 100)} size={104} strokeWidth={9} label="本週完成" />
          <p className="mt-1 text-xs text-bark-400">{plan.week_completed} / {plan.week_prescribed} 次</p>
        </div>
      </header>

      <div className="mb-6 grid gap-6 lg:grid-cols-[0.8fr_2fr]">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-bark-700">復健目標</h2>
          <ol className="mt-4 space-y-3">
            {plan.goals.map((goal, index) => (
              <motion.li key={goal} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="flex gap-3 text-sm leading-6 text-bark-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xs font-semibold text-sage-700">{index + 1}</span>
                {goal}
              </motion.li>
            ))}
          </ol>
        </section>

        <section className="card p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-bark-700">復健動作</h2>
            <p className="mt-1 text-xs text-bark-400">
              先觀看導師示範影片與注意事項，拍攝自己的練習影片上傳，AI 會自動比對評分
            </p>
          </div>
          {plan.items.length === 0 ? (
            <EmptyState message="護理師尚未安排復健動作" />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {plan.items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-sand bg-white">
                  {/* 有綁導師影片才能播放示範與上傳比對；未綁時顯示佔位卡（可能只有外部示範連結） */}
                  {item.teacher_video ? (
                    <VideoPlayer
                      src={teacherVideoUrl(item.teacher_video.id)}
                      title={`${item.name} 導師示範`}
                      aspect="video"
                      className="rounded-b-none border-0"
                    />
                  ) : (
                    <VideoPlaceholder title={item.name} subtitle={item.example_video_note ?? '導師示範影片準備中'} videoUrl={item.example_video_url} />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-bark-700">{item.name}</h3>
                      <span className="rounded-full bg-sage-50 px-2.5 py-1 text-[11px] text-sage-700">{item.frequency ?? `每週 ${item.times_per_week} 次`}</span>
                    </div>
                    {item.description && <p className="mt-2 text-sm leading-6 text-bark-500">{item.description}</p>}
                    {item.precaution && <p className="mt-2 text-xs text-rust">注意：{item.precaution}</p>}
                    <div className="mt-3">
                      <SubmissionUploader planId={plan.id} item={item} onFinished={reload} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-bark-700">動作分數趨勢</h2>
          <p className="mb-3 mt-1 text-xs text-bark-400">整體、關節角度、穩定度與姿勢分數</p>
          {plan.score_trend.length > 0 ? <ScoreTrendChart data={plan.score_trend} detailed /> : <EmptyState message="尚無分析結果" />}
        </section>
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-bark-700">每週完成率</h2>
          <p className="mb-3 mt-1 text-xs text-bark-400">上傳次數與處方頻率比較</p>
          {plan.completion_trend.length > 0 ? <CompletionTrendChart data={plan.completion_trend} /> : <EmptyState message="尚無完成率資料" />}
        </section>
      </div>

      {/* 上傳紀錄：badge 一律用後端預算的 display_status（FAILED > 管線階段 > 業務狀態），
          summary_text 是演算法自動判讀、feedback 才是護理師人工回饋，兩者並列呈現 */}
      <section className="card p-6">
        <h2 className="font-display text-lg font-semibold text-bark-700">我的上傳紀錄</h2>
        <p className="mt-1 text-xs text-bark-400">查看演算法評分與護理師回饋</p>
        {plan.submissions.length === 0 ? (
          <EmptyState message="尚無上傳紀錄" hint="完成居家復健影片後，紀錄會出現在這裡" />
        ) : (
          <div className="mt-5 divide-y divide-sand">
            {plan.submissions.map((submission, index) => (
              <motion.article key={submission.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.4) }} className="grid gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-bark-700">{submission.item_name}</h3>
                    <StatusBadge status={submission.display_status} label={statusLabel(submission.display_status, 'patient')} />
                    {submission.decision && <StatusBadge status={submission.decision} label={decisionLabel[submission.decision]} />}
                  </div>
                  <p className="mt-1 text-xs text-bark-400">{formatDateTime(submission.submitted_at)}</p>
                  {submission.summary_text && <p className="mt-2 text-sm leading-6 text-bark-500">{submission.summary_text}</p>}
                  {submission.feedback && (
                    <div className="mt-3 flex gap-2 rounded-xl bg-sage-50/70 p-3 text-sm text-sage-800">
                      <MessageCircle size={16} className="mt-0.5 shrink-0" />
                      <p><strong>{submission.reviewer_name ? withRole(submission.reviewer_name, 'nurse') : '護理師'}：</strong>{submission.feedback}</p>
                    </div>
                  )}
                </div>
                {/* 右欄三態：有分數顯示分數、分析失敗顯示錯誤、其餘（管線進行中）顯示轉圈 */}
                <div className="flex min-w-28 items-center justify-end gap-2">
                  {submission.overall_score !== null ? (
                    <><CheckCircle2 size={18} style={{ color: scoreColor(submission.overall_score) }} /><strong className="text-2xl tabular-nums" style={{ color: scoreColor(submission.overall_score) }}>{Math.round(submission.overall_score)}</strong><span className="text-xs text-bark-300">分</span></>
                  ) : submission.display_status === 'FAILED' ? (
                    <span className="text-xs text-rust" title={submission.analysis_error ?? undefined}>分析失敗</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-bark-300"><Loader2 size={12} className="animate-spin" /> {statusLabel(submission.display_status, 'patient')}</span>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </section>
    </PageTransition>
  )
}
