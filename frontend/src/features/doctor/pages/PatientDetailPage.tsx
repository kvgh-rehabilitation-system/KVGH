import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Cake,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  FilePlus2,
  IdCard,
  Phone,
  Stethoscope,
  User,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getPatient, listPatientVisits } from '../../../api/doctor'
import { VisitTimeline } from '../../../components/VisitTimeline'
import { EmptyState } from '../../../components/ui/EmptyState'
import { InfoGrid } from '../../../components/ui/InfoGrid'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition, staggerContainer } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SummaryCard } from '../../../components/ui/SummaryCard'
import { Tabs } from '../../../components/ui/Tabs'
import type { PatientDetail, Visit } from '../../../types'
import {
  formatDate,
  genderLabel,
  rehabDecisionLabel,
  rehabStatusLabel,
} from '../../../utils/format'

const tabs = [
  { key: 'overview', label: '病患概覽' },
  { key: 'visits', label: '看診歷史' },
  { key: 'plan', label: '復健計畫' },
]

export function PatientDetailPage() {
  const { patientId } = useParams()
  const [detail, setDetail] = useState<PatientDetail | null>(null)
  const [visits, setVisits] = useState<Visit[] | null>(null)
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    if (!patientId) return
    getPatient(patientId).then(setDetail)
    listPatientVisits(patientId).then(setVisits)
  }, [patientId])

  if (!detail) return <Loading />

  const { basic, summary } = detail

  return (
    <PageTransition>
      <Link
        to="/doctor/patients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回病患列表
      </Link>

      {/* Patient Header */}
      <div className="card mb-6 flex flex-wrap items-center gap-5 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-100 text-xl font-semibold text-sage-700">
          {basic.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-bark-700">{basic.name}</h1>
            <StatusBadge
              status={detail.rehab_status}
              label={rehabStatusLabel[detail.rehab_status] ?? detail.rehab_status}
            />
          </div>
          <p className="mt-1 text-sm text-bark-400">
            病患編號 {basic.patient_number} · {basic.age} 歲 /{' '}
            {genderLabel[basic.gender] ?? basic.gender}
          </p>
        </div>
        <Link to={`/doctor/patients/${basic.id}/visits/new`} className="btn-primary">
          <FilePlus2 size={16} /> 新增看診記錄
        </Link>
      </div>

      {/* Summary cards */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <SummaryCard
          label="看診次數"
          value={summary.visit_count}
          icon={Stethoscope}
        />
        <SummaryCard
          label="進行中計畫"
          value={summary.active_plan_count}
          icon={ClipboardList}
          tone="sage"
        />
        <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} className="card flex items-start gap-4 p-5">
          <div className="rounded-xl bg-parchment p-3 text-bark-500">
            <CalendarCheck size={22} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm text-bark-400">最近看診</p>
            <p className="mt-1 text-lg font-semibold text-bark-700">
              {formatDate(summary.last_visit_date)}
            </p>
          </div>
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} className="card flex items-start gap-4 p-5">
          <div className="rounded-xl bg-clay-50 p-3 text-clay-600">
            <Activity size={22} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm text-bark-400">最近居家復健上傳</p>
            <p className="mt-1 text-lg font-semibold text-bark-700">
              {formatDate(summary.last_submission_date)}
            </p>
          </div>
        </motion.div>
      </motion.div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} layoutId="patient-detail-tabs" />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="mt-6"
        >
          {tab === 'overview' && <OverviewTab detail={detail} />}
          {tab === 'visits' &&
            (visits && visits.length > 0 ? (
              <VisitTimeline visits={visits} />
            ) : (
              <EmptyState message="尚無看診紀錄" />
            ))}
          {tab === 'plan' && <PlanTab detail={detail} />}
        </motion.div>
      </AnimatePresence>
    </PageTransition>
  )
}

function OverviewTab({ detail }: { detail: PatientDetail }) {
  const { basic, latest_visit } = detail
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sage-400" />
          <h3 className="text-base font-semibold text-bark-700">基本資料</h3>
        </div>
        <InfoGrid
          items={[
            { icon: User, label: '姓名', value: basic.name },
            { icon: IdCard, label: '病患編號', value: basic.patient_number },
            { icon: Cake, label: '出生日期', value: formatDate(basic.birth_date) },
            { icon: CalendarDays, label: '年齡', value: `${basic.age} 歲` },
            { icon: Users, label: '性別', value: genderLabel[basic.gender] ?? basic.gender },
            { icon: Phone, label: '聯絡電話', value: basic.phone ?? '—' },
            { icon: FilePlus2, label: '建檔日期', value: formatDate(basic.created_at), span: true },
          ]}
        />
      </section>

      <div className="space-y-6">
        <section className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-bark-700">最近看診</h3>
          {latest_visit ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-bark-700">{formatDate(latest_visit.visit_date)}</p>
              <div>
                <p className="text-xs text-bark-300">主訴</p>
                <p className="mt-0.5 text-bark-600">{latest_visit.chief_complaint || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-bark-300">診斷</p>
                <p className="mt-0.5 text-bark-600">{latest_visit.diagnosis || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-bark-300">醫生評估</p>
                <p className="mt-0.5 text-bark-600">{latest_visit.assessment || '—'}</p>
              </div>
              {latest_visit.rehab_decision && (
                <p className="text-xs text-bark-400">
                  醫療決策：
                  <span className="font-medium text-clay-600">
                    {rehabDecisionLabel[latest_visit.rehab_decision] ??
                      latest_visit.rehab_decision}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <EmptyState message="尚無看診紀錄" />
          )}
        </section>

        <PlanCardSection detail={detail} compact />
      </div>
    </div>
  )
}

function PlanTab({ detail }: { detail: PatientDetail }) {
  return <PlanCardSection detail={detail} />
}

function PlanCardSection({ detail, compact = false }: { detail: PatientDetail; compact?: boolean }) {
  const plan = detail.current_plan
  return (
    <section className="card p-6">
      <h3 className="mb-4 text-base font-semibold text-bark-700">目前復健計畫</h3>
      {plan ? (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-lg font-medium text-bark-700">{plan.name}</p>
            <StatusBadge status={plan.status} label={rehabStatusLabel[plan.status] ?? plan.status} />
            {plan.current_version && (
              <span className="text-xs text-bark-300">V{plan.current_version}</span>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-bark-300">開始日期</dt>
              <dd className="mt-0.5 text-bark-600">{formatDate(plan.start_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-bark-300">預計評估</dt>
              <dd className="mt-0.5 text-bark-600">{formatDate(plan.evaluation_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-bark-300">負責治療人員</dt>
              <dd className="mt-0.5 text-bark-600">{plan.nurse_name ?? '—'}</dd>
            </div>
          </dl>
          <Link to={`/doctor/rehabilitation-plans/${plan.id}`} className="btn-secondary mt-5">
            查看計畫
          </Link>
        </div>
      ) : (
        <EmptyState
          message="目前沒有進行中的復健計畫"
          hint={compact ? undefined : '可於看診時建立新的復健計畫'}
        />
      )}
    </section>
  )
}
