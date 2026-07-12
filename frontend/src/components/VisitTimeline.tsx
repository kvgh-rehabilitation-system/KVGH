import { motion } from 'framer-motion'
import { Stethoscope } from 'lucide-react'
import type { Visit } from '../types'
import { StatusBadge } from './ui/StatusBadge'
import {
  formatDate,
  rehabDecisionLabel,
  visitTypeLabel,
} from '../utils/format'

/** 看診歷史 Timeline：逐項浮現動畫，醫生端與病患端共用 */
export function VisitTimeline({ visits }: { visits: Visit[] }) {
  return (
    <div className="relative space-y-6 pl-8">
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-sand" />
      {visits.map((visit, index) => (
        <motion.div
          key={visit.id}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-clay-50 text-clay-500 ring-4 ring-cream">
            <Stethoscope size={13} />
          </div>
          <div className="card p-5 transition-shadow hover:shadow-lifted">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-bark-700">
                {formatDate(visit.visit_date)}
              </span>
              <StatusBadge
                status={visit.visit_type}
                label={visitTypeLabel[visit.visit_type] ?? visit.visit_type}
              />
              <span className="text-xs text-bark-300">{visit.doctor_name}</span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-bark-300">主訴</dt>
                <dd className="mt-0.5 text-bark-600">{visit.chief_complaint || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-bark-300">診斷</dt>
                <dd className="mt-0.5 text-bark-600">{visit.diagnosis || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-bark-300">醫生評估</dt>
                <dd className="mt-0.5 text-bark-600">{visit.assessment || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-bark-300">醫療決策</dt>
                <dd className="mt-0.5 font-medium text-clay-600">
                  {visit.rehab_decision
                    ? (rehabDecisionLabel[visit.rehab_decision] ?? visit.rehab_decision)
                    : '—'}
                </dd>
              </div>
            </dl>
            {visit.follow_up_date && (
              <p className="mt-3 border-t border-sand pt-2.5 text-xs text-bark-400">
                預約回診：{formatDate(visit.follow_up_date)}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
