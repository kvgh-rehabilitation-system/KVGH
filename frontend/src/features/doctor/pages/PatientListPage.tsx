import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { listPatients } from '../../../api/doctor'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChips } from '../../../components/ui/FilterChips'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import { SearchBar } from '../../../components/ui/SearchBar'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { PatientListItem } from '../../../types'
import { formatDate, genderLabel, rehabStatusLabel } from '../../../utils/format'

const visitTypeFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'FIRST', label: '初診' },
  { key: 'FOLLOW_UP', label: '回診' },
]

const rehabFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'NO_PLAN', label: '無復健計畫' },
  { key: 'ONGOING', label: '進行中' },
  { key: 'PENDING_EVALUATION', label: '待評估' },
  { key: 'CLOSED', label: '已結案' },
]

export function PatientListPage() {
  const [patients, setPatients] = useState<PatientListItem[] | null>(null)
  const [search, setSearch] = useState('')
  const [visitType, setVisitType] = useState('ALL')
  const [rehabStatus, setRehabStatus] = useState('ALL')

  useEffect(() => {
    listPatients({}).then(setPatients)
  }, [])

  const filtered = useMemo(() => {
    if (!patients) return []
    return patients.filter((p) => {
      if (
        search &&
        !p.name.includes(search) &&
        !p.patient_number.toLowerCase().includes(search.toLowerCase())
      )
        return false
      if (visitType !== 'ALL' && p.visit_type !== visitType) return false
      if (rehabStatus !== 'ALL' && p.rehab_status !== rehabStatus) return false
      return true
    })
  }, [patients, search, visitType, rehabStatus])

  if (!patients) return <Loading />

  return (
    <PageTransition>
      <PageHeader title="病患列表" subtitle="管理與查看所有病患資料" />

      {/* 巢狀 flex-wrap：空間夠時全並排；不夠時先整組換行，再窄時兩組各自成行 */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="w-72 max-w-full">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-bark-400">病患類型</span>
              <FilterChips
                options={visitTypeFilters}
                active={visitType}
                onChange={setVisitType}
                layoutId="patient-visit-type"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-bark-400">復健狀態</span>
              <FilterChips
                options={rehabFilters}
                active={rehabStatus}
                onChange={setRehabStatus}
                layoutId="patient-rehab-status"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState message="找不到符合條件的病患" hint="請調整搜尋或篩選條件" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-5 py-3.5 font-medium">病患</th>
                  <th className="px-5 py-3.5 font-medium">年齡</th>
                  <th className="px-5 py-3.5 font-medium">性別</th>
                  <th className="px-5 py-3.5 font-medium">最近看診</th>
                  <th className="px-5 py-3.5 font-medium">復健狀態</th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.5) }}
                    className="group border-b border-sand/60 transition-colors last:border-0 hover:bg-clay-50/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-bark-700">{p.name}</p>
                      <p className="text-xs text-bark-300">{p.patient_number}</p>
                    </td>
                    <td className="px-5 py-3.5 text-bark-500">{p.age}</td>
                    <td className="px-5 py-3.5 text-bark-500">
                      {genderLabel[p.gender] ?? p.gender}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-bark-500">{formatDate(p.last_visit_date)}</span>
                      {p.is_overdue && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-[#F7E8E4] px-2 py-0.5 text-[11px] font-medium text-rust">
                          逾期未回診
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={p.rehab_status}
                        label={rehabStatusLabel[p.rehab_status] ?? p.rehab_status}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        to={`/doctor/patients/${p.id}`}
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
