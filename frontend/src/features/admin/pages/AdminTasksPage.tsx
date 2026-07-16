import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { listTasks, reanalyzeSubmission } from '../../../api/admin'
import { apiErrorMessage } from '../../../api/client'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChips } from '../../../components/ui/FilterChips'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { usePollingReload } from '../../../hooks/usePollingReload'
import type { AdminTaskList } from '../../../types'
import { formatDateTime } from '../../../utils/format'
import {
  displayStatusLabel,
  PIPELINE_ACTIVE_STATUSES,
  statusLabel,
} from '../../../utils/submissionStatus'

const PAGE_SIZE = 20

/**
 * 管理員分析任務監控頁：以「演算法管線狀態」（analysis_status）為軸列出所有影片繳交，
 * FAILED 的任務可一鍵重新排入分析（後端複用 nurse_service.reanalyze_submission）。
 * 有任務在跑時自動輪詢刷新。
 */
export function AdminTasksPage() {
  const [data, setData] = useState<AdminTaskList | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  // 正在送出重新分析請求的 submission id；用來鎖按鈕防連點
  const [reanalyzing, setReanalyzing] = useState<number | null>(null)

  // 篩選/分頁是後端做的（總量可能上千筆），條件變動即重新查詢
  const reload = useCallback(() => {
    return listTasks({
      analysis_status: statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      page_size: PAGE_SIZE,
    }).then(setData)
  }, [statusFilter, page])

  useEffect(() => {
    reload()
  }, [reload])

  // status_counts 是不分頁的全域統計，任一管線階段（排隊/轉檔/萃取/比對）有數量就輪詢，
  // 即使當前分頁沒顯示進行中的任務也要刷新（狀態變化會反映到各 chip 的計數）
  const hasInProgress = useMemo(
    () => !!data && PIPELINE_ACTIVE_STATUSES.some((s) => (data.status_counts[s] ?? 0) > 0),
    [data],
  )
  usePollingReload(reload, hasInProgress)

  // 篩選 chip：計數為 0 的中間態不顯示（避免一排空 chip），
  // 但 DONE / FAILED 恆顯示——管理員最常直接點「失敗」查問題
  const filters = useMemo(() => {
    const counts = data?.status_counts ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return [
      { key: 'ALL', label: `全部 ${total}` },
      ...(['PENDING', 'TRANSCODING', 'EXTRACTING', 'COMPARING', 'DONE', 'FAILED'] as const)
        .filter((s) => (counts[s] ?? 0) > 0 || s === 'DONE' || s === 'FAILED')
        .map((s) => ({ key: s, label: `${displayStatusLabel[s]} ${counts[s] ?? 0}` })),
    ]
  }, [data])

  /**
   * 將失敗任務重新排入分析管線。
   * 副作用：後端會清掉舊分析結果並重跑整條管線（轉檔→萃取→比對），GPU 任務可能耗時數分鐘。
   */
  const handleReanalyze = async (submissionId: number) => {
    setReanalyzing(submissionId)
    try {
      await reanalyzeSubmission(submissionId)
      toast.info(`#${submissionId} 已重新排入分析，背景處理中…`)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setReanalyzing(null)
    }
  }

  if (!data) return <Loading />

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <PageTransition>
      <PageHeader
        title="分析任務"
        subtitle="影片分析管線狀態監控，失敗任務可重新排入分析"
      />

      <div className="card mb-6 p-5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-bark-400">分析狀態</span>
          <FilterChips
            options={filters}
            active={statusFilter}
            onChange={(key) => {
              setStatusFilter(key)
              setPage(1)
            }}
            layoutId="admin-task-status"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {data.items.length === 0 ? (
          <EmptyState message="沒有符合條件的分析任務" hint="請調整篩選條件" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-5 py-3.5 font-medium">編號</th>
                  <th className="px-5 py-3.5 font-medium">病患</th>
                  <th className="px-5 py-3.5 font-medium">復健動作</th>
                  <th className="px-5 py-3.5 font-medium">送出時間</th>
                  <th className="px-5 py-3.5 font-medium">分析狀態</th>
                  <th className="px-5 py-3.5 font-medium">錯誤訊息</th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t, i) => (
                  <motion.tr
                    key={t.submission_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4) }}
                    className="border-b border-sand/60 transition-colors last:border-0 hover:bg-clay-50/40"
                  >
                    <td className="px-5 py-3.5 font-medium text-bark-700">#{t.submission_id}</td>
                    <td className="px-5 py-3.5 text-bark-700">{t.patient_name}</td>
                    <td className="px-5 py-3.5 text-bark-500">{t.item_name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-bark-500">{formatDateTime(t.submitted_at)}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge
                        status={t.analysis_status}
                        label={statusLabel(t.analysis_status)}
                      />
                    </td>
                    <td className="max-w-[16rem] px-5 py-3.5">
                      {t.analysis_error ? (
                        <span className="block truncate text-xs text-rust" title={t.analysis_error}>
                          {t.analysis_error}
                        </span>
                      ) : (
                        <span className="text-bark-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {/* 只有 FAILED 才給重新分析——重跑進行中/已完成的任務會浪費 GPU 且蓋掉有效結果 */}
                      {t.analysis_status === 'FAILED' && (
                        <button
                          className="btn-ghost inline-flex items-center gap-1.5 text-clay-600"
                          disabled={reanalyzing === t.submission_id}
                          onClick={() => handleReanalyze(t.submission_id)}
                        >
                          <RotateCcw
                            size={14}
                            className={reanalyzing === t.submission_id ? 'animate-spin' : ''}
                          />
                          重新分析
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm text-bark-500">
          <button
            className="btn-ghost px-2 py-1.5"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            className="btn-ghost px-2 py-1.5"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </PageTransition>
  )
}
