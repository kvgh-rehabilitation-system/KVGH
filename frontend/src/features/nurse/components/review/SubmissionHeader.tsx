import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../../../components/ui/StatusBadge'
import type { SubmissionDetail } from '../../../../types'
import { decisionLabel, formatDateTime, genderLabel } from '../../../../utils/format'
import { statusLabel } from '../../../../utils/submissionStatus'

/**
 * 審核頁標頭：動作名稱、狀態徽章、病患與計畫資訊。
 *
 * 護理師與醫師端共用：role 決定病患連結導向哪個角色的病患詳情路由，
 * readOnly（醫師借看時）額外顯示「唯讀檢視」標示。
 * 狀態徽章一律用後端預算的 display_status（勿自行組合 status + analysis_status）。
 */
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
          status={data.display_status}
          label={statusLabel(data.display_status)}
        />
        {/* 已審核才有 decision（通過/需注意），與分析狀態徽章並列 */}
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
