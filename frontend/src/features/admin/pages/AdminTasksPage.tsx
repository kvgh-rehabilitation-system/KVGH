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
import type { AdminTaskList } from '../../../types'
import { formatDateTime } from '../../../utils/format'
import { analysisStatusLabel, IN_PROGRESS_STATUSES } from '../labels'

const PAGE_SIZE = 20
const POLL_MS = 10_000

export function AdminTasksPage() {
  const [data, setData] = useState<AdminTaskList | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [reanalyzing, setReanalyzing] = useState<number | null>(null)

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

  // 有任務在跑時輪詢刷新
  const hasInProgress = useMemo(
    () =>
      !!data &&
      (IN_PROGRESS_STATUSES.some((s) => (data.status_counts[s] ?? 0) > 0) ||
        (data.status_counts['PENDING'] ?? 0) > 0),
    [data],
  )
  useEffect(() => {
    if (!hasInProgress) return
    const timer = setInterval(reload, POLL_MS)
    return () => clearInterval(timer)
  }, [hasInProgress, reload])

  const filters = useMemo(() => {
    const counts = data?.status_counts ?? {}
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return [
      { key: 'ALL', label: `全部 ${total}` },
      ...(['PENDING', 'TRANSCODING', 'EXTRACTING', 'COMPARING', 'DONE', 'FAILED'] as const)
        .filter((s) => (counts[s] ?? 0) > 0 || s === 'DONE' || s === 'FAILED')
        .map((s) => ({ key: s, label: `${analysisStatusLabel[s]} ${counts[s] ?? 0}` })),
    ]
  }, [data])

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
                        label={analysisStatusLabel[t.analysis_status] ?? t.analysis_status}
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
