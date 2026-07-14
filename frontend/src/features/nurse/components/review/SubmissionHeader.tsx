import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import type { SubmissionDetail } from '../../../../types'
import {
  decisionLabel,
  formatDateTime,
  genderLabel,
  submissionStatusLabel,
} from '../../../../utils/format'

/** 審核頁標頭：動作名稱、狀態、病患與計畫資訊 */
export function SubmissionHeader({
  data,
  role = 'nurse',
  readOnly = false,
}: {
  data: SubmissionDetail
  role?: 'doctor' | 'nurse'
  readOnly?: boolean
}) {
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-bark-700">{data.item.name}</h1>
        <StatusBadge
          status={data.status}
          label={submissionStatusLabel[data.status] ?? data.status}
        />
        {data.decision && (
          <StatusBadge status={data.decision} label={decisionLabel[data.decision]} />
        )}
        {readOnly && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-parchment px-2.5 py-1 text-xs text-bark-400">
            <Eye size={13} /> 唯讀檢視
          </span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-bark-300">病患</dt>
          <dd className="mt-0.5">
            <Link
              to={`/${role}/patients/${data.patient_id}`}
              className="font-medium text-clay-600 hover:underline"
            >
              {data.patient_name}
            </Link>
            <span className="ml-1.5 text-xs text-bark-300">
              {data.patient_number}・{data.patient_age} 歲{' '}
              {genderLabel[data.patient_gender] ?? ''}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-bark-300">復健計畫</dt>
          <dd className="mt-0.5 text-bark-600">
            {data.plan_name} <span className="text-xs text-bark-300">V{data.plan_version}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-bark-300">上傳時間</dt>
          <dd className="mt-0.5 tabular-nums text-bark-600">{formatDateTime(data.submitted_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-bark-300">影片長度</dt>
          <dd className="mt-0.5 text-bark-600">
            {data.duration_seconds ? `${data.duration_seconds} 秒` : '—'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
