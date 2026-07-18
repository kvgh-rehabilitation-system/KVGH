import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listPlans } from '../../../api/patient'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import { staggerContainer, staggerItem } from '../../../components/ui/motionVariants'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { PortalPlanListItem } from '../../../types'
import { formatDate, rehabStatusLabel, withRole } from '../../../utils/format'

/**
 * 病患端復健計畫列表：卡片顯示每份計畫的狀態、主治團隊與前三項目標，
 * 點卡片進入 PortalPlanDetailPage 看動作與上傳影片。
 */
export function PortalPlanListPage() {
  // null = 載入中（顯示 Loading），[] = 無計畫（顯示 EmptyState）
  const [plans, setPlans] = useState<PortalPlanListItem[] | null>(null)

  useEffect(() => {
    listPlans().then(setPlans)
  }, [])

  if (!plans) return <Loading />

  return (
    <PageTransition>
      <PageHeader title="我的復健計畫" subtitle="醫療團隊為您安排的復健計畫" />
      {plans.length === 0 ? (
        <EmptyState message="尚無復健計畫" />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-5 md:grid-cols-2"
        >
          {plans.map((plan) => (
            <motion.div key={plan.id} variants={staggerItem}>
              <Link
                to={`/portal/rehabilitation-plans/${plan.id}`}
                className="card group block p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lifted"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-sage-50 p-3 text-sage-600">
                    <ClipboardList size={20} strokeWidth={1.8} />
                  </div>
                  <StatusBadge
                    status={plan.status}
                    label={rehabStatusLabel[plan.status] ?? plan.status}
                  />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-bark-700">{plan.name}</h2>
                <p className="mt-1 text-xs text-bark-400">
                  {formatDate(plan.start_date)} 開始 · {withRole(plan.doctor_name, 'doctor')}
                  {plan.nurse_name && ` · ${withRole(plan.nurse_name, 'nurse')}`}
                </p>
                {/* 目標最多預覽 3 條，完整清單在詳情頁——卡片高度才不會被長計畫撐爆 */}
                {plan.goals.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {plan.goals.slice(0, 3).map((goal) => (
                      <li key={goal} className="flex items-center gap-2 text-sm text-bark-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-clay-400" />
                        {goal}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 flex items-center gap-1 text-xs font-medium text-clay-600">
                  {plan.item_count} 個復健項目
                  <ChevronRight
                    size={14}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageTransition>
  )
}
