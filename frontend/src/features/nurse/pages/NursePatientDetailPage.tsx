import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  ListChecks,
  Phone,
  Stethoscope,
  Target,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPatient } from '../../../api/nurse'
import { CompletionTrendChart } from '../../../components/ui/CompletionTrendChart'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { ScoreTrendChart } from '../../../components/ui/ScoreTrendChart'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Tabs } from '../../../components/ui/Tabs'
import type { NursePatientDetail } from '../../../types'
import {
  decisionLabel,
  formatDate,
  formatDateTime,
  genderLabel,
  rehabStatusLabel,
  scoreColor,
  submissionStatusLabel,
} from '../../../utils/format'

const tabs = [
  { key: 'plan', label: '計畫與動作' },
  { key: 'submissions', label: '上傳審核紀錄' },
  { key: 'diagnosis', label: '診斷摘要' },
]

export function NursePatientDetailPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<NursePatientDetail | null>(null)
  const [tab, setTab] = useState('plan')

  useEffect(() => {
    if (patientId) getPatient(patientId).then(setData)
  }, [patientId])

  if (!data) return <Loading />

  const plan = data.current_plan

  return (
    <PageTransition>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回
      </button>

      {/* 病患標頭 */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 font-display text-xl font-semibold text-sage-700">
            {data.basic.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-semibold text-bark-700">
                {data.basic.name}
              </h1>
              <StatusBadge
                status={data.rehab_status}
                label={rehabStatusLabel[data.rehab_status] ?? data.rehab_status}
              />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-bark-400">
              <span>{data.basic.patient_number}</span>
              <span>
                {data.basic.age} 歲・{genderLabel[data.basic.gender] ?? data.basic.gender}
              </span>
              {data.basic.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={13} /> {data.basic.phone}
                </span>
              )}
            </p>
          </div>
          {plan && (
            <Link to={`/nurse/plans/${plan.id}/items`} className="btn-primary">
              <ListChecks size={16} /> 動作管理
            </Link>
          )}
        </div>
      </div>

      {/* 趨勢雙圖 */}
      {(data.score_trend.length > 0 || data.completion_trend.length > 0) && (
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-bark-700">動作分數趨勢</h2>
            {data.score_trend.length > 0 ? (
              <ScoreTrendChart data={data.score_trend} height={200} detailed />
            ) : (
              <EmptyState message="尚無分析資料" />
            )}
          </section>
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-bark-700">每週完成率</h2>
            {data.completion_trend.length > 0 ? (
              <CompletionTrendChart data={data.completion_trend} height={200} />
            ) : (
              <EmptyState message="尚無上傳資料" />
            )}
          </section>
        </div>
      )}

      <div className="card p-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} layoutId="nurse-patient-tabs" />

        <div className="pt-5">
          {tab === 'plan' &&
            (plan ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-semibold text-bark-700">{plan.name}</h3>
                  <span className="text-xs text-bark-300">V{plan.version}</span>
                  <StatusBadge
                    status={plan.status}
                    label={rehabStatusLabel[plan.status] ?? plan.status}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-bark-300">主治醫師</dt>
                    <dd className="mt-0.5 text-bark-600">{plan.doctor_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-bark-300">開始日期</dt>
                    <dd className="mt-0.5 tabular-nums text-bark-600">
                      {formatDate(plan.start_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-bark-300">預計評估日</dt>
                    <dd className="mt-0.5 tabular-nums text-bark-600">
                      {formatDate(plan.evaluation_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-bark-300">負責護理師</dt>
                    <dd className="mt-0.5 text-bark-600">{plan.nurse_name ?? '—'}</dd>
                  </div>
                </dl>

                {plan.goals.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Target size={14} className="text-clay-500" />
                    {plan.goals.map((g) => (
                      <span
                        key={g}
                        className="rounded-lg bg-parchment px-2.5 py-1 text-xs text-bark-600"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {plan.items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-xl border border-sand bg-parchment/40 p-4"
                    >
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="font-medium text-bark-700">{item.name}</p>
                        {item.frequency && (
                          <span className="rounded-lg bg-sage-100 px-2 py-0.5 text-xs text-sage-700">
                            {item.frequency}
                          </span>
                        )}
                        {item.example_video_url ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-clay-50 px-2 py-0.5 text-xs text-clay-600">
                            <Clapperboard size={11} /> 有範例影片
                          </span>
                        ) : (
                          <span className="text-xs text-bark-300">未設定範例影片</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="mt-1.5 text-sm text-bark-500">{item.description}</p>
                      )}
                      {item.precaution && (
                        <p className="mt-1.5 text-xs text-rust">注意：{item.precaution}</p>
                      )}
                    </motion.div>
                  ))}
                  {plan.items.length === 0 && (
                    <EmptyState message="尚未制定復健動作，點右上角「動作管理」開始。" />
                  )}
                </div>
              </div>
            ) : (
              <EmptyState message="目前沒有進行中的復健計畫" />
            ))}

          {tab === 'submissions' &&
            (data.submissions.length === 0 ? (
              <EmptyState message="尚無上傳紀錄" />
            ) : (
              <ul className="space-y-3">
                {data.submissions.map((sub, i) => (
                  <motion.li
                    key={sub.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-sand p-4"
                  >
                    <span className="w-36 tabular-nums text-xs text-bark-400">
                      {formatDateTime(sub.submitted_at)}
                    </span>
                    <span className="min-w-[7rem] flex-1 text-sm text-bark-600">
                      {sub.item_name}
                    </span>
                    {sub.overall_score !== null && (
                      <span
                        className="text-base font-semibold tabular-nums"
                        style={{ color: scoreColor(sub.overall_score) }}
                      >
                        {Math.round(sub.overall_score)}
                        <span className="ml-0.5 text-xs font-normal text-bark-300">分</span>
                      </span>
                    )}
                    <StatusBadge
                      status={sub.status}
                      label={submissionStatusLabel[sub.status] ?? sub.status}
                    />
                    {sub.decision && (
                      <StatusBadge status={sub.decision} label={decisionLabel[sub.decision]} />
                    )}
                    {sub.status !== 'ANALYZING' && (
                      <Link to={`/nurse/submissions/${sub.id}`} className="btn-ghost text-xs">
                        {sub.status === 'PENDING_REVIEW' ? '審核' : '查看'}
                      </Link>
                    )}
                  </motion.li>
                ))}
              </ul>
            ))}

          {tab === 'diagnosis' &&
            (data.diagnosis_summary ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-2 text-bark-400">
                  <Stethoscope size={15} />
                  <span>{data.diagnosis_summary.doctor_name}</span>
                  <CalendarDays size={15} className="ml-2" />
                  <span className="tabular-nums">
                    {formatDate(data.diagnosis_summary.visit_date)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-bark-300">診斷</p>
                  <p className="mt-1 leading-relaxed text-bark-600">
                    {data.diagnosis_summary.diagnosis ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-bark-300">醫生評估</p>
                  <p className="mt-1 leading-relaxed text-bark-600">
                    {data.diagnosis_summary.assessment ?? '—'}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState message="尚無看診紀錄" />
            ))}
        </div>
      </div>
    </PageTransition>
  )
}
