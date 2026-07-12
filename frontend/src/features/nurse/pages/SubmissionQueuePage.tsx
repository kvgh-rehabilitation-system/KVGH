import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Cpu, MonitorPlay } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listSubmissions } from '../../../api/nurse'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChips } from '../../../components/ui/FilterChips'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition, staggerContainer } from '../../../components/ui/PageTransition'
import { SearchBar } from '../../../components/ui/SearchBar'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SummaryCard } from '../../../components/ui/SummaryCard'
import type { SubmissionListResponse } from '../../../types'
import {
  decisionLabel,
  formatDateTime,
  scoreColor,
  submissionStatusLabel,
} from '../../../utils/format'

const statusFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING_REVIEW', label: '待審核' },
  { key: 'ANALYZING', label: '分析中' },
  { key: 'REVIEWED', label: '已審核' },
]

const decisionFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'APPROVED', label: '通過' },
  { key: 'NEEDS_ATTENTION', label: '需注意' },
]

export function SubmissionQueuePage() {
  const [data, setData] = useState<SubmissionListResponse | null>(null)
  const [status, setStatus] = useState('PENDING_REVIEW')
  const [decision, setDecision] = useState('ALL')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setData(null)
    listSubmissions({
      status: status === 'ALL' ? undefined : status,
      decision: decision === 'ALL' ? undefined : decision,
      search: search || undefined,
    }).then(setData)
  }, [status, decision, search])

  return (
    <PageTransition>
      <PageHeader title="影片審核" subtitle="檢視演算法分析結果，快速完成居家復健影片審核" />

      {data && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <SummaryCard
            label="待審核"
            value={data.summary.pending_review_count}
            icon={MonitorPlay}
            tone="amber"
          />
          <SummaryCard
            label="演算法分析中"
            value={data.summary.analyzing_count}
            icon={Cpu}
            tone="clay"
          />
          <SummaryCard
            label="今日已審核"
            value={data.summary.reviewed_today_count}
            icon={CheckCircle2}
            tone="sage"
          />
          <SummaryCard
            label="分數異常"
            value={data.summary.needs_attention_count}
            icon={AlertCircle}
            tone="rust"
          />
        </motion.div>
      )}

      {/* 巢狀 flex-wrap：空間夠時全並排；不夠時先整組換行，再窄時兩組各自成行 */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="w-72 max-w-full">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="搜尋病患姓名 / 病患編號 / 計畫或動作名稱"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-bark-400">狀態</span>
              <FilterChips
                options={statusFilters}
                active={status}
                onChange={setStatus}
                layoutId="sub-status-filter"
              />
            </div>
            {status === 'REVIEWED' && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-bark-400">審核結果</span>
                <FilterChips
                  options={decisionFilters}
                  active={decision}
                  onChange={setDecision}
                  layoutId="sub-decision-filter"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!data ? (
          <Loading />
        ) : data.submissions.length === 0 ? (
          <EmptyState message="沒有符合條件的上傳影片" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-5 py-3.5 font-medium">上傳時間</th>
                  <th className="px-5 py-3.5 font-medium">病患</th>
                  <th className="px-5 py-3.5 font-medium">復健動作</th>
                  <th className="px-5 py-3.5 font-medium">動作分數</th>
                  <th className="px-5 py-3.5 font-medium">狀態</th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((sub, i) => (
                  <motion.tr
                    key={sub.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.5) }}
                    className="group border-b border-sand/60 transition-colors last:border-0 hover:bg-clay-50/40"
                  >
                    <td className="px-5 py-3.5 tabular-nums text-bark-600">
                      {formatDateTime(sub.submitted_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-bark-700">{sub.patient_name}</p>
                      <p className="text-xs text-bark-300">{sub.patient_number}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-bark-600">{sub.item_name}</p>
                      <p className="text-xs text-bark-300">{sub.plan_name}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {sub.overall_score !== null ? (
                        <span
                          className="text-base font-semibold tabular-nums"
                          style={{ color: scoreColor(sub.overall_score) }}
                        >
                          {Math.round(sub.overall_score)}
                          <span className="ml-0.5 text-xs font-normal text-bark-300">分</span>
                        </span>
                      ) : (
                        <span className="text-xs text-bark-300">分析中…</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          status={sub.status}
                          label={submissionStatusLabel[sub.status] ?? sub.status}
                        />
                        {sub.decision && (
                          <StatusBadge
                            status={sub.decision}
                            label={decisionLabel[sub.decision] ?? sub.decision}
                          />
                        )}
                        {sub.needs_attention && sub.status === 'PENDING_REVIEW' && (
                          <StatusBadge status="NEEDS_ATTENTION" label="分數異常" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {sub.status === 'ANALYZING' ? (
                        <span className="text-xs text-bark-300">等待演算法</span>
                      ) : (
                        <Link
                          to={`/nurse/submissions/${sub.id}`}
                          className={
                            sub.status === 'PENDING_REVIEW'
                              ? 'btn-primary px-3.5 py-1.5 text-xs'
                              : 'btn-ghost opacity-70 group-hover:opacity-100'
                          }
                        >
                          {sub.status === 'PENDING_REVIEW' ? '審核' : '查看'}
                        </Link>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
