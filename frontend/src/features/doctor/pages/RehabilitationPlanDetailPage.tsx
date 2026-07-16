import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronDown, ChevronRight, ListChecks, PencilLine, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../../../api/client'
import {
  closePlan,
  getPlan as getDoctorPlan,
  getPlanSubmissions as getDoctorPlanSubmissions,
} from '../../../api/doctor'
import { getPlan as getNursePlan, getPlanSubmissions as getNursePlanSubmissions } from '../../../api/nurse'
import { CompletionTrendChart } from '../../../components/ui/CompletionTrendChart'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { ScoreTrendChart } from '../../../components/ui/ScoreTrendChart'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { usePollingReload } from '../../../hooks/usePollingReload'
import type { PlanDetail, PlanSubmissionsView, PlanVersion } from '../../../types'
import {
  decisionLabel,
  formatDate,
  formatDateTime,
  rehabStatusLabel,
  scoreColor,
} from '../../../utils/format'
import { isPipelineActive, statusLabel } from '../../../utils/submissionStatus'

interface Props {
  /** 醫護共用此頁：依角色切換 API 來源、返回連結與操作按鈕（醫師可調整/結束，護理師管理動作） */
  role?: 'doctor' | 'nurse'
}

/**
 * 復健計畫詳情頁（醫師/護理師共用）：計畫 header + 目前版本的目標與項目 +
 * 分數/完成率趨勢 + 上傳審核紀錄表 + 歷史版本手風琴。
 * 放在 doctor feature 下但由兩種角色的路由掛載，透過 role prop 區分。
 */
export function RehabilitationPlanDetailPage({ role = 'doctor' }: Props) {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [subs, setSubs] = useState<PlanSubmissionsView | null>(null)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  // 上傳紀錄獨立成 reload 函式：輪詢只重抓這一份（計畫本體不會因分析進度改變）
  const reloadSubs = useCallback(() => {
    if (!planId) return
    const loadSubmissions = role === 'doctor' ? getDoctorPlanSubmissions : getNursePlanSubmissions
    return loadSubmissions(planId).then(setSubs)
  }, [planId, role])

  useEffect(() => {
    if (planId) {
      const loadPlan = role === 'doctor' ? getDoctorPlan : getNursePlan
      loadPlan(planId).then(setPlan)
      reloadSubs()
    }
  }, [planId, role, reloadSubs])

  // 有影片在演算法管線時輪詢上傳紀錄（不重抓計畫本體）
  usePollingReload(
    reloadSubs,
    !!subs && subs.submissions.some((s) => isPipelineActive(s.display_status)),
  )

  if (!plan) return <Loading />

  // 有效計畫（進行中/待評估）才顯示調整、結束、動作管理等操作按鈕
  const isActive = ['ONGOING', 'PENDING_EVALUATION'].includes(plan.status)
  const current = plan.current_version

  /**
   * 結束計畫（僅醫師可見此按鈕）。副作用：後端把計畫標為 CLOSED，不可復原；
   * 成功後重抓計畫本體更新狀態與按鈕列。
   */
  const handleClose = async () => {
    if (!planId) return
    try {
      await closePlan(planId)
      setConfirmClose(false)
      setPlan(await getDoctorPlan(planId))
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <PageTransition>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回
      </button>

      {/* Header */}
      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-bark-700">{plan.name}</h1>
              <StatusBadge
                status={plan.status}
                label={rehabStatusLabel[plan.status] ?? plan.status}
              />
            </div>
            <p className="mt-1.5 text-sm text-bark-400">
              病患：
              <Link
                to={`/${role}/patients/${plan.patient_id}`}
                className="font-medium text-clay-600 hover:underline"
              >
                {plan.patient_name}
              </Link>{' '}
              （{plan.patient_number}） · 建立醫師：{plan.doctor_name} · 護理師：
              {plan.nurse_name ?? '—'}
            </p>
          </div>
          {isActive && role === 'doctor' && (
            <div className="flex gap-2">
              <Link to={`/doctor/rehabilitation-plans/${plan.id}/adjust`} className="btn-secondary">
                <PencilLine size={15} /> 調整計畫
              </Link>
              <button onClick={() => setConfirmClose(true)} className="btn-secondary text-rust hover:border-rust/40 hover:text-rust">
                <XCircle size={15} /> 結束計畫
              </button>
            </div>
          )}
          {isActive && role === 'nurse' && (
            <Link to={`/nurse/plans/${plan.id}/items`} className="btn-primary">
              <ListChecks size={15} /> 動作管理
            </Link>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-sand pt-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-bark-300">目前版本</dt>
            <dd className="mt-0.5 font-medium text-bark-700">
              {current ? `V${current.version}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-bark-300">開始日期</dt>
            <dd className="mt-0.5 text-bark-600">{formatDate(plan.start_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-bark-300">最後調整</dt>
            <dd className="mt-0.5 text-bark-600">
              {plan.last_adjusted_at ? formatDate(plan.last_adjusted_at) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-bark-300">預計評估</dt>
            <dd className="mt-0.5 text-bark-600">{formatDate(plan.evaluation_date)}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-[#F7E8E4] px-4 py-3 text-sm text-rust">{error}</p>
      )}

      {current && (
        <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          {/* 復健目標 */}
          <section className="card p-6">
            <h2 className="mb-4 text-base font-semibold text-bark-700">復健目標</h2>
            <ol className="space-y-2.5">
              {current.goals.map((goal, i) => (
                <motion.li
                  key={goal}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 text-sm text-bark-600"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xs font-semibold text-sage-700">
                    {i + 1}
                  </span>
                  {goal}
                </motion.li>
              ))}
            </ol>
          </section>

          {/* 復健項目 */}
          <section className="card overflow-hidden">
            <h2 className="px-6 pb-3 pt-6 text-base font-semibold text-bark-700">復健項目</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-6 py-3 font-medium">項目</th>
                  <th className="px-6 py-3 font-medium">頻率</th>
                  <th className="px-6 py-3 font-medium">說明</th>
                </tr>
              </thead>
              <tbody>
                {current.items.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="border-b border-sand/60 last:border-0"
                  >
                    <td className="px-6 py-3.5 font-medium text-bark-700">{item.name}</td>
                    <td className="px-6 py-3.5 text-bark-500">{item.frequency ?? '—'}</td>
                    <td className="px-6 py-3.5 text-bark-500">
                      {item.description ?? '—'}
                      {item.precaution && (
                        <p className="mt-0.5 text-xs text-rust/80">注意：{item.precaution}</p>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {subs && (
        <div className="mb-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-6">
              <h2 className="font-display text-lg font-semibold text-bark-700">動作分數趨勢</h2>
              <p className="mb-3 mt-1 text-xs text-bark-400">依影片演算法分析結果</p>
              {subs.score_trend.length > 0 ? (
                <ScoreTrendChart data={subs.score_trend} detailed />
              ) : (
                <EmptyState message="尚無分數資料" />
              )}
            </section>
            <section className="card p-6">
              <h2 className="font-display text-lg font-semibold text-bark-700">每週完成率</h2>
              <p className="mb-3 mt-1 text-xs text-bark-400">上傳次數與處方頻率比較</p>
              {subs.completion_trend.length > 0 ? (
                <CompletionTrendChart data={subs.completion_trend} />
              ) : (
                <EmptyState message="尚無完成率資料" />
              )}
            </section>
          </div>

          <section className="card p-6">
            <h2 className="font-display text-lg font-semibold text-bark-700">上傳與審核紀錄</h2>
            <p className="mt-1 text-xs text-bark-400">病患居家影片的分析與護理師判定</p>
            {subs.submissions.length === 0 ? (
              <EmptyState message="尚無上傳紀錄" />
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-y border-sand bg-parchment/50 text-left text-xs text-bark-400">
                      <th className="px-4 py-3 font-medium">上傳時間</th>
                      <th className="px-4 py-3 font-medium">動作</th>
                      <th className="px-4 py-3 font-medium">分數</th>
                      <th className="px-4 py-3 font-medium">分析狀態</th>
                      <th className="px-4 py-3 font-medium">審核判定</th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {/* 整列可點：依角色導向各自的審核/檢視頁（醫師唯讀、護理師可審核） */}
                    {subs.submissions.map((submission) => (
                      <tr
                        key={submission.id}
                        onClick={() => navigate(`/${role}/submissions/${submission.id}`)}
                        className="cursor-pointer border-b border-sand/70 transition-colors last:border-0 hover:bg-parchment/50"
                      >
                        <td className="px-4 py-3.5 text-bark-500">{formatDateTime(submission.submitted_at)}</td>
                        <td className="px-4 py-3.5 font-medium text-bark-700">{submission.item_name}</td>
                        <td className="px-4 py-3.5 font-semibold tabular-nums" style={submission.overall_score !== null ? { color: scoreColor(submission.overall_score) } : undefined}>
                          {submission.overall_score !== null ? Math.round(submission.overall_score) : '—'}
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={submission.display_status} label={statusLabel(submission.display_status)} /></td>
                        <td className="px-4 py-3.5">{submission.decision ? <StatusBadge status={submission.decision} label={decisionLabel[submission.decision]} /> : <span className="text-bark-300">—</span>}</td>
                        <td className="px-4 py-3.5 text-bark-300"><ChevronRight size={15} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 歷史版本 */}
      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-bark-700">歷史版本</h2>
        <div className="space-y-3">
          {plan.versions.map((version) => (
            <VersionAccordion
              key={version.id}
              version={version}
              defaultOpen={version.is_current}
            />
          ))}
        </div>
      </section>

      {/* 結束計畫確認 */}
      <AnimatePresence>
        {confirmClose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bark-800/30 p-4 backdrop-blur-sm"
            onClick={() => setConfirmClose(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="card w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-bark-700">結束復健計畫</h3>
              <p className="mt-2 text-sm text-bark-500">
                確定要結束「{plan.name}」嗎？計畫將標記為已結案，此操作無法復原。
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setConfirmClose(false)} className="btn-secondary">
                  取消
                </button>
                <button
                  onClick={handleClose}
                  className="btn-primary bg-rust hover:bg-[#9c4835]"
                >
                  確認結束
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  )
}

/**
 * 單一計畫版本的摺疊卡：標頭顯示版號/起訖日/是否現行，展開顯示變更摘要、目標與項目。
 * 現行版本預設展開，歷史版本收合。
 */
function VersionAccordion({
  version,
  defaultOpen,
}: {
  version: PlanVersion
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-xl border border-sand">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 bg-parchment/40 px-5 py-3.5 text-left transition-colors hover:bg-parchment/70"
      >
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-bark-400" />
        </motion.span>
        <span className="text-sm font-semibold text-bark-700">V{version.version}</span>
        <span className="text-xs text-bark-400">
          {formatDate(version.started_at)} — {version.ended_at ? formatDate(version.ended_at) : '現在'}
        </span>
        {version.is_current ? (
          <StatusBadge status="ONGOING" label="目前版本" />
        ) : (
          <StatusBadge status="CLOSED" label="已調整" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="space-y-4 px-5 py-4 text-sm">
              {version.change_summary && (
                <div>
                  <p className="text-xs text-bark-300">變更摘要</p>
                  <p className="mt-0.5 text-bark-600">{version.change_summary}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-bark-300">復健目標</p>
                <ul className="mt-1 list-inside list-decimal space-y-0.5 text-bark-600">
                  {version.goals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-xs text-bark-300">復健項目</p>
                <div className="flex flex-wrap gap-2">
                  {version.items.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-lg bg-parchment px-3 py-1.5 text-xs text-bark-600"
                    >
                      {item.name}
                      {item.frequency && (
                        <span className="text-bark-400"> · {item.frequency}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
