import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, MonitorPlay, TrendingDown, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../../../api/nurse'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition, staggerContainer } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SummaryCard } from '../../../components/ui/SummaryCard'
import { useAuth } from '../../../contexts/AuthContext'
import { usePollingReload } from '../../../hooks/usePollingReload'
import type { NurseDashboard } from '../../../types'
import { formatDateTime, greeting, scoreColor, todayHeading } from '../../../utils/format'
import { statusLabel } from '../../../utils/submissionStatus'

/**
 * 護理師端首頁儀表板：審核工作統計 + 待審核佇列（分數異常紅框標記）+
 * 需注意病患側欄（分數下滑/低分原因由後端判定）。
 */
export function NurseDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<NurseDashboard | null>(null)

  const reload = useCallback(() => getDashboard().then(setData), [])

  useEffect(() => {
    reload()
  }, [reload])

  // 有影片在演算法管線時輪詢，分析完成自動進入待審核佇列
  usePollingReload(reload, (data?.summary.analyzing_count ?? 0) > 0)

  if (!data) return <Loading />

  return (
    <PageTransition>
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-semibold tracking-tight text-bark-700"
        >
          {greeting()}，{user?.name} 護理師
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-1.5 text-sm text-bark-400"
        >
          {todayHeading()} · 居家復健審核工作總覽
        </motion.p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <SummaryCard
          label="待審核影片"
          value={data.summary.pending_review_count}
          icon={MonitorPlay}
          tone="amber"
        />
        <SummaryCard
          label="今日已審核"
          value={data.summary.reviewed_today_count}
          icon={CheckCircle2}
          tone="sage"
        />
        <SummaryCard
          label="需注意病患"
          value={data.summary.attention_patient_count}
          icon={TrendingDown}
          tone="rust"
        />
        <SummaryCard label="我的病患" value={data.summary.my_patient_count} icon={Users} />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* 待審核佇列 */}
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-bark-700">待審核佇列</h2>
            <Link to="/nurse/submissions" className="btn-ghost text-xs">
              查看全部審核
            </Link>
          </div>

          {data.review_queue.length === 0 ? (
            <EmptyState message="目前沒有待審核的影片，太棒了！" />
          ) : (
            <ul className="space-y-3.5">
              {data.review_queue.map((sub, i) => (
                <motion.li
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border p-4 transition-shadow hover:shadow-soft ${
                    sub.needs_attention ? 'border-rust/30 bg-[#FBF5F3]' : 'border-sand bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[7rem]">
                      <p className="text-sm font-medium text-bark-700">{sub.patient_name}</p>
                      <p className="text-xs text-bark-300">{sub.patient_number}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-bark-600">{sub.item_name}</p>
                      <p className="truncate text-xs text-bark-300">
                        {sub.plan_name} · {formatDateTime(sub.submitted_at)}
                      </p>
                    </div>
                    {sub.overall_score !== null && (
                      <span
                        className="text-lg font-semibold tabular-nums"
                        style={{ color: scoreColor(sub.overall_score) }}
                      >
                        {Math.round(sub.overall_score)}
                        <span className="ml-0.5 text-xs font-normal text-bark-300">分</span>
                      </span>
                    )}
                    <StatusBadge
                      status={sub.display_status}
                      label={statusLabel(sub.display_status)}
                    />
                    {sub.needs_attention && <StatusBadge status="NEEDS_ATTENTION" label="分數異常" />}
                  </div>
                  <div className="mt-2.5 flex gap-2">
                    <Link to={`/nurse/patients/${sub.patient_id}`} className="btn-ghost text-xs">
                      查看病患
                    </Link>
                    <Link
                      to={`/nurse/submissions/${sub.id}`}
                      className="btn-primary px-3.5 py-1.5 text-xs"
                    >
                      開始審核
                    </Link>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        {/* 需要注意 */}
        <section className="card h-fit p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-bark-700">
            <AlertCircle size={17} className="text-amberwarm" />
            需要注意
          </h2>
          {data.attention_items.length === 0 ? (
            <EmptyState message="目前沒有需要特別注意的病患" />
          ) : (
            <ul className="space-y-3.5">
              {data.attention_items.map((item, i) => (
                <motion.li
                  key={`${item.patient_id}-${i}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-xl bg-[#FDFAF2] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-bark-700">{item.patient_name}</p>
                      <p className="text-xs text-bark-400">{item.plan_name}</p>
                    </div>
                    {item.last_score !== null && (
                      <span
                        className="text-xl font-semibold tabular-nums"
                        style={{ color: scoreColor(item.last_score) }}
                      >
                        {Math.round(item.last_score)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-bark-500">
                    {item.score_delta !== null && item.score_delta < 0 && (
                      <p className="flex items-center gap-1 text-rust">
                        <TrendingDown size={12} /> 較前次下滑 {Math.abs(item.score_delta)} 分
                      </p>
                    )}
                    <p>{item.reason}</p>
                  </div>
                  <Link to={`/nurse/patients/${item.patient_id}`} className="btn-ghost mt-2 text-xs">
                    查看病患
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageTransition>
  )
}
