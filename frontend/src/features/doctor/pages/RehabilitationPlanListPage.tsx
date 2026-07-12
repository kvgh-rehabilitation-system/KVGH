import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Archive, CalendarClock, ClipboardCheck, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPlanSummary, listPlans } from '../../../api/doctor'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChips } from '../../../components/ui/FilterChips'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition, staggerContainer } from '../../../components/ui/PageTransition'
import { SearchBar } from '../../../components/ui/SearchBar'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SummaryCard } from '../../../components/ui/SummaryCard'
import type { PlanListItem, PlanListSummary } from '../../../types'
import { formatDate, rehabStatusLabel } from '../../../utils/format'

const statusFilters = [
  { key: 'ACTIVE', label: '有效計畫' },
  { key: 'ONGOING', label: '進行中' },
  { key: 'PENDING_EVALUATION', label: '待評估' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CLOSED', label: '已結案' },
  { key: 'CANCELLED', label: '已取消' },
]

export function RehabilitationPlanListPage() {
  const [summary, setSummary] = useState<PlanListSummary | null>(null)
  const [plans, setPlans] = useState<PlanListItem[] | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ACTIVE')

  useEffect(() => {
    getPlanSummary().then(setSummary)
  }, [])

  useEffect(() => {
    setPlans(null)
    listPlans({ search: search || undefined, status }).then(setPlans)
  }, [search, status])

  return (
    <PageTransition>
      <PageHeader title="復健計畫" subtitle="查看與管理目前病患復健計畫" />

      {summary && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <SummaryCard label="進行中" value={summary.ongoing} icon={ClipboardCheck} tone="sage" />
          <SummaryCard
            label="待評估"
            value={summary.pending_evaluation}
            icon={CalendarClock}
            tone="amber"
          />
          <SummaryCard label="即將結束" value={summary.ending_soon} icon={Timer} tone="clay" />
          <SummaryCard label="已結案" value={summary.closed} icon={Archive} tone="bark" />
        </motion.div>
      )}

      {/* 巢狀 flex-wrap：空間夠時全並排；不夠時先整組換行，再窄時兩組各自成行 */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="w-72 max-w-full">
            <SearchBar value={search} onChange={setSearch} placeholder="搜尋病患姓名 / 計畫名稱" />
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-bark-400">狀態</span>
              <FilterChips
                options={statusFilters}
                active={status}
                onChange={setStatus}
                layoutId="plan-status-filter"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!plans ? (
          <Loading />
        ) : plans.length === 0 ? (
          <EmptyState message="沒有符合條件的復健計畫" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-5 py-3.5 font-medium">病患</th>
                  <th className="px-5 py-3.5 font-medium">計畫名稱</th>
                  <th className="px-5 py-3.5 font-medium">狀態</th>
                  <th className="px-5 py-3.5 font-medium">開始日期</th>
                  <th className="px-5 py-3.5 font-medium">評估日期</th>
                  <th className="px-5 py-3.5 font-medium">治療人員</th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan, i) => (
                  <motion.tr
                    key={plan.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.5) }}
                    className="group border-b border-sand/60 transition-colors last:border-0 hover:bg-clay-50/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-bark-700">{plan.patient_name}</p>
                      <p className="text-xs text-bark-300">{plan.patient_number}</p>
                    </td>
                    <td className="px-5 py-3.5 text-bark-600">{plan.name}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={plan.status}
                        label={rehabStatusLabel[plan.status] ?? plan.status}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-bark-500">{formatDate(plan.start_date)}</td>
                    <td className="px-5 py-3.5 text-bark-500">
                      {formatDate(plan.evaluation_date)}
                    </td>
                    <td className="px-5 py-3.5 text-bark-500">{plan.nurse_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/doctor/rehabilitation-plans/${plan.id}`}
                        className="btn-ghost opacity-70 transition-opacity group-hover:opacity-100"
                      >
                        查看
                      </Link>
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
