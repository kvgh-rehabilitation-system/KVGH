import { useEffect, useState } from 'react'
import { ArrowLeft, ListChecks, Phone } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getPatient } from '../../../api/nurse'
import { PlanHistoryList } from '../../../components/PlanHistoryList'
import { VisitTimeline } from '../../../components/VisitTimeline'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Tabs } from '../../../components/ui/Tabs'
import type { NursePatientDetail } from '../../../types'
import { genderLabel, rehabStatusLabel } from '../../../utils/format'

const tabs = [
  { key: 'plans', label: '復健計畫歷史' },
  { key: 'visits', label: '看診歷史' },
]

/**
 * 護理師端病患詳情頁：基本資料 header + 兩分頁（計畫歷史/看診歷史）。
 * 比醫師版精簡——護理師的主要操作是「動作管理」，由 header 按鈕直達目前計畫。
 */
export function NursePatientDetailPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<NursePatientDetail | null>(null)
  const [tab, setTab] = useState('plans')

  useEffect(() => {
    if (patientId) getPatient(patientId).then(setData)
  }, [patientId])

  if (!data) return <Loading />

  return (
    <PageTransition>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回
      </button>

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
          {data.current_plan && (
            <Link to={`/nurse/plans/${data.current_plan.id}/items`} className="btn-primary">
              <ListChecks size={16} /> 動作管理
            </Link>
          )}
        </div>
      </div>

      <div className="card p-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} layoutId="nurse-patient-tabs" />
        <div className="pt-5">
          {tab === 'plans' && <PlanHistoryList plans={data.plans} role="nurse" />}
          {tab === 'visits' &&
            (data.visits.length > 0 ? (
              <VisitTimeline visits={data.visits} />
            ) : (
              <EmptyState message="尚無看診紀錄" />
            ))}
        </div>
      </div>
    </PageTransition>
  )
}
