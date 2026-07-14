import { CalendarDays, ChevronRight, ClipboardList, ListChecks, UserRound } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { PlanCard } from '../types'
import { formatDate, rehabStatusLabel } from '../utils/format'
import { StatusBadge } from './ui/StatusBadge'

interface Props {
  plans: PlanCard[]
  role: 'doctor' | 'nurse'
}

const activeStatuses = new Set(['ONGOING', 'PENDING_EVALUATION'])

export function PlanHistoryList({ plans, role }: Props) {
  if (plans.length === 0) {
    return <p className="py-10 text-center text-sm text-bark-300">尚無復健計畫</p>
  }

  const current = plans.filter((plan) => activeStatuses.has(plan.status))
  const history = plans.filter((plan) => !activeStatuses.has(plan.status))

  return (
    <div className="space-y-6">
      {current.length > 0 && (
        <section>
          <h4 className="mb-2.5 text-xs font-semibold tracking-wide text-bark-300">目前計畫</h4>
          <div className="space-y-3">
            {current.map((plan, index) => (
              <PlanHistoryCard key={plan.id} plan={plan} role={role} index={index} isActive />
            ))}
          </div>
        </section>
      )}
      {history.length > 0 && (
        <section>
          <h4 className="mb-2.5 text-xs font-semibold tracking-wide text-bark-300">歷史計畫</h4>
          <div className="space-y-3">
            {history.map((plan, index) => (
              <PlanHistoryCard
                key={plan.id}
                plan={plan}
                role={role}
                index={current.length + index}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function PlanHistoryCard({
  plan,
  role,
  index,
  isActive = false,
}: {
  plan: PlanCard
  role: 'doctor' | 'nurse'
  index: number
  isActive?: boolean
}) {
  const detailPath =
    role === 'doctor' ? `/doctor/rehabilitation-plans/${plan.id}` : `/nurse/plans/${plan.id}`

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className={`rounded-xl border px-5 py-4 transition-shadow hover:shadow-soft ${
        isActive ? 'border-clay-200/80 bg-white' : 'border-sand bg-parchment/40'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className={`font-medium ${isActive ? 'text-bark-700' : 'text-bark-500'}`}>
              {plan.name}
            </h3>
            <StatusBadge
              status={plan.status}
              label={rehabStatusLabel[plan.status] ?? plan.status}
            />
            {plan.current_version && (
              <span className="text-xs text-bark-300">V{plan.current_version}</span>
            )}
            {plan.pending_review_count > 0 && (
              <span className="rounded-lg bg-rust/10 px-2 py-0.5 text-xs font-medium text-rust">
                待審 {plan.pending_review_count} 筆
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-bark-400">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={13} />
              {formatDate(plan.start_date)}－{formatDate(plan.evaluation_date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={13} />
              {plan.doctor_name}・{plan.nurse_name ?? '未指派護理師'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardList size={13} />
              {plan.item_count} 個動作
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {role === 'nurse' && isActive && (
            <Link to={`/nurse/plans/${plan.id}/items`} className="btn-ghost text-xs">
              <ListChecks size={14} /> 動作管理
            </Link>
          )}
          <Link to={detailPath} className="btn-secondary text-xs">
            查看計畫 <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}
