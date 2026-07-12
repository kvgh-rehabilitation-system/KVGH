import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarHeart, MessageCircle, Sparkles, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../../../api/patient'
import { CompletionTrendChart } from '../../../components/ui/CompletionTrendChart'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition, staggerContainer, staggerItem } from '../../../components/ui/PageTransition'
import { ProgressRing } from '../../../components/ui/ProgressRing'
import { ScoreTrendChart } from '../../../components/ui/ScoreTrendChart'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { PatientDashboard } from '../../../types'
import { formatDate, greeting, rehabStatusLabel, scoreColor } from '../../../utils/format'

export function PortalDashboardPage() {
  const [data, setData] = useState<PatientDashboard | null>(null)

  useEffect(() => {
    getDashboard().then(setData)
  }, [])

  if (!data) return <Loading />

  return (
    <PageTransition>
      <header className="mb-8">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-clay-600">
          {data.patient_number}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 font-display text-3xl font-semibold tracking-tight text-bark-700"
        >
          {greeting()}，{data.name}
        </motion.h1>
        <p className="mt-2 text-sm text-bark-400">查看本週進度與動作分析結果</p>
      </header>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-6 xl:grid-cols-12"
      >
        <motion.section variants={staggerItem} className="card p-6 xl:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-bark-700">本週完成率</h2>
              <p className="mt-1 text-xs text-bark-400">{data.current_plan_name ?? '目前無進行中計畫'}</p>
            </div>
            {data.current_plan_status && (
              <StatusBadge
                status={data.current_plan_status}
                label={rehabStatusLabel[data.current_plan_status] ?? data.current_plan_status}
              />
            )}
          </div>
          <div className="mt-5 flex justify-center">
            <ProgressRing progress={Math.round(data.week_completion_rate * 100)} label="本週完成" />
          </div>
          <p className="mt-3 text-center text-sm text-bark-500">
            已上傳 <strong className="text-sage-700">{data.week_completed}</strong> / {data.week_prescribed} 次
          </p>
          {data.current_plan_id && (
            <Link to={`/portal/rehabilitation-plans/${data.current_plan_id}`} className="btn-secondary mt-5 w-full justify-center">
              查看復健計畫
            </Link>
          )}
        </motion.section>

        <motion.section variants={staggerItem} className="card p-6 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-bark-700">動作分數趨勢</h2>
              <p className="mt-1 text-xs text-bark-400">依每次影片分析的整體分數</p>
            </div>
            {data.latest_score !== null && (
              <strong className="text-2xl tabular-nums" style={{ color: scoreColor(data.latest_score) }}>
                {Math.round(data.latest_score)}
              </strong>
            )}
          </div>
          {data.score_trend.length > 0 ? (
            <ScoreTrendChart data={data.score_trend} height={230} />
          ) : (
            <p className="flex h-[230px] items-center justify-center text-sm text-bark-300">尚無分析資料</p>
          )}
        </motion.section>

        <motion.div variants={staggerItem} className="space-y-6 xl:col-span-3">
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-clay-50 p-3 text-clay-600"><CalendarHeart size={20} /></span>
              <div>
                <p className="text-xs text-bark-400">下次回診</p>
                <p className="mt-0.5 font-semibold text-bark-700">{formatDate(data.next_follow_up_date)}</p>
              </div>
            </div>
          </section>
          <section className="card p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-sage-50 p-3 text-sage-700"><MessageCircle size={20} /></span>
              <h2 className="font-semibold text-bark-700">最新護理師回饋</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-bark-500">
              {data.latest_feedback ?? '影片審核完成後，護理師的建議會顯示在這裡。'}
            </p>
            {data.latest_feedback_nurse && (
              <p className="mt-2 text-xs text-bark-300">— {data.latest_feedback_nurse}</p>
            )}
          </section>
        </motion.div>
      </motion.div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold text-bark-700">每週上傳完成率</h2>
          <p className="mb-3 mt-1 text-xs text-bark-400">實際上傳次數與處方頻率比較</p>
          <CompletionTrendChart data={data.completion_trend} />
        </section>
        <section className="relative overflow-hidden rounded-2xl bg-bark-700 p-6 text-white shadow-lifted">
          <Sparkles className="absolute right-5 top-5 text-clay-200/50" />
          <UploadCloud size={28} className="text-clay-200" />
          <h2 className="mt-5 font-display text-xl font-semibold">居家影片上傳</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">依範例完成動作並上傳，系統將自動分析姿勢與穩定度。</p>
          <span className="mt-5 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">即將推出</span>
        </section>
      </div>
    </PageTransition>
  )
}
