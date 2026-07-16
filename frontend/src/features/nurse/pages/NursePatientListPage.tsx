import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { listMyPatients } from '../../../api/nurse'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChips } from '../../../components/ui/FilterChips'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import { SearchBar } from '../../../components/ui/SearchBar'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { NursePatientRow } from '../../../types'
import {
  formatDate,
  genderLabel,
  rehabStatusLabel,
  scoreColor,
} from '../../../utils/format'

const statusFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'ONGOING', label: '進行中' },
  { key: 'PENDING_EVALUATION', label: '待評估' },
  { key: 'CLOSED', label: '已結案' },
]

// 檢視範圍：mine = 只列自己負責計畫的病患（預設）；all = 全院病患（支援跨護理師代理照護）
type Scope = 'mine' | 'all'

const scopeOptions: { key: Scope; label: string }[] = [
  { key: 'mine', label: '我的病患' },
  { key: 'all', label: '全部病患' },
]

/**
 * 護理師端病患列表：我的/全部範圍切換 + 搜尋 + 計畫狀態篩選，
 * 表格附待審核數、最近上傳與最新分數，是進入動作管理與病患詳情的入口。
 * 「全部病患」模式多一欄負責護理師，標示哪些是自己負責的。
 */
export function NursePatientListPage() {
  const [rows, setRows] = useState<NursePatientRow[] | null>(null)
  const [scope, setScope] = useState<Scope>('mine')
  const [search, setSearch] = useState('')
  const [planStatus, setPlanStatus] = useState('ALL')

  // 篩選由後端執行；條件一變先清成 null 顯示 Loading 再重查
  useEffect(() => {
    setRows(null)
    listMyPatients({
      scope,
      search: search || undefined,
      plan_status: planStatus === 'ALL' ? undefined : planStatus,
    }).then(setRows)
  }, [scope, search, planStatus])

  return (
    <PageTransition>
      <PageHeader
        title="我的病患"
        subtitle={
          scope === 'mine' ? '我負責照護的復健計畫與病患' : '全院病患總覽（含其他護理師負責）'
        }
        actions={
          <div className="flex rounded-full border border-sand bg-parchment/60 p-0.5">
            {scopeOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => setScope(o.key)}
                className={`relative rounded-full px-4 py-1.5 text-xs transition-all ${
                  scope === o.key
                    ? 'font-medium text-clay-600'
                    : 'text-bark-400 hover:text-bark-600'
                }`}
              >
                {scope === o.key && (
                  <motion.span
                    layoutId="nurse-scope-pill"
                    className="absolute inset-0 rounded-full bg-white shadow-soft"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative">{o.label}</span>
              </button>
            ))}
          </div>
        }
      />

      {/* 巢狀 flex-wrap：空間夠時全並排；不夠時先整組換行，再窄時兩組各自成行 */}
      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="w-72 max-w-full">
            <SearchBar value={search} onChange={setSearch} placeholder="搜尋病患姓名 / 病患編號" />
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-bark-400">計畫狀態</span>
              <FilterChips
                options={statusFilters}
                active={planStatus}
                onChange={setPlanStatus}
                layoutId="nurse-patient-filter"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!rows ? (
          <Loading />
        ) : rows.length === 0 ? (
          <EmptyState
            message={scope === 'mine' ? '目前沒有你負責的病患' : '沒有符合條件的病患'}
            hint={
              scope === 'mine'
                ? '可切換「全部病患」檢視所有病患資料'
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-5 py-3.5 font-medium">病患</th>
                  <th className="px-5 py-3.5 font-medium">年齡 / 性別</th>
                  <th className="px-5 py-3.5 font-medium">復健計畫</th>
                  {scope === 'all' && <th className="px-5 py-3.5 font-medium">負責護理師</th>}
                  <th className="px-5 py-3.5 font-medium">待審核</th>
                  <th className="px-5 py-3.5 font-medium">最近上傳</th>
                  <th className="px-5 py-3.5 font-medium">最新分數</th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.patient_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.5) }}
                    className="group border-b border-sand/60 transition-colors last:border-0 hover:bg-clay-50/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-bark-700">{row.patient_name}</p>
                      <p className="text-xs text-bark-300">{row.patient_number}</p>
                    </td>
                    <td className="px-5 py-3.5 text-bark-500">
                      {row.age} 歲・{genderLabel[row.gender] ?? row.gender}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.plan_name && row.plan_status ? (
                        <>
                          <p className="mb-1 text-bark-600">{row.plan_name}</p>
                          <StatusBadge
                            status={row.plan_status}
                            label={rehabStatusLabel[row.plan_status] ?? row.plan_status}
                          />
                        </>
                      ) : (
                        <span className="text-xs text-bark-300">尚無復健計畫</span>
                      )}
                    </td>
                    {scope === 'all' && (
                      <td className="px-5 py-3.5">
                        {row.is_mine ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-2.5 py-1 text-xs font-medium text-clay-700">
                            我負責
                          </span>
                        ) : row.nurse_name ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-2.5 py-1 text-xs text-bark-500">
                            {row.nurse_name}
                          </span>
                        ) : (
                          <span className="text-xs text-bark-300">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-5 py-3.5">
                      {row.pending_review_count > 0 ? (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FBF3E2] px-2 text-xs font-semibold text-[#A87A24]">
                          {row.pending_review_count}
                        </span>
                      ) : (
                        <span className="text-xs text-bark-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-bark-500">
                      {formatDate(row.latest_submission_date)}
                    </td>
                    <td className="px-5 py-3.5">
                      {row.latest_score !== null ? (
                        <span
                          className="text-base font-semibold tabular-nums"
                          style={{ color: scoreColor(row.latest_score) }}
                        >
                          {Math.round(row.latest_score)}
                          <span className="ml-0.5 text-xs font-normal text-bark-300">分</span>
                        </span>
                      ) : (
                        <span className="text-xs text-bark-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {row.plan_id !== null && (
                          <Link
                            to={`/nurse/plans/${row.plan_id}/items`}
                            className="btn-ghost opacity-70 group-hover:opacity-100"
                          >
                            動作管理
                          </Link>
                        )}
                        <Link
                          to={`/nurse/patients/${row.patient_id}`}
                          className="btn-ghost opacity-70 group-hover:opacity-100"
                        >
                          詳細
                        </Link>
                      </div>
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
