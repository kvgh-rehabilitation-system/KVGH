import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  ClipboardList,
  Hourglass,
  Megaphone,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import { getDashboard, reviewReport } from '../../../api/doctor'
import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FilterChips } from '../../../components/ui/FilterChips'
import { Loading } from '../../../components/ui/Loading'
import {
  PageTransition,
  staggerContainer,
} from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SummaryCard } from '../../../components/ui/SummaryCard'
import { Textarea } from '../../../components/ui/textarea'
import { useAuth } from '../../../contexts/AuthContext'
import type { DoctorDashboard, NurseReport } from '../../../types'
import {
  formatDate,
  formatDateTime,
  greeting,
  rehabStatusLabel,
  reportKindLabel,
  severityLabel,
  todayHeading,
  visitStatusLabel,
  visitTypeLabel,
} from '../../../utils/format'

const statusFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'WAITING', label: '待看診' },
  { key: 'IN_CONSULTATION', label: '看診中' },
  { key: 'COMPLETED', label: '已完成' },
]

export function DoctorDashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<DoctorDashboard | null>(null)
  const [filter, setFilter] = useState('ALL')
  const [replying, setReplying] = useState<NurseReport | null>(null)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getDashboard().then(setData)
  }, [])

  if (!data) return <Loading />

  const patients = data.today_patients.filter(
    (p) => filter === 'ALL' || p.status === filter,
  )

  const submitReply = async () => {
    if (!replying) return
    setSaving(true)
    try {
      await reviewReport(replying.id, comment || null)
      toast.success('回報已處理')
      setReplying(null)
      setComment('')
      setData(await getDashboard())
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageTransition>
      <div className="mb-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-semibold tracking-tight text-bark-700"
        >
          {greeting()}，{user?.name} 醫師
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-1.5 text-sm text-bark-400"
        >
          {todayHeading()} · 今日看診工作總覽
        </motion.p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <SummaryCard label="今日病患" value={data.summary.today_patient_count} icon={Users} />
        <SummaryCard
          label="待看診"
          value={data.summary.waiting_patient_count}
          icon={Hourglass}
          tone="amber"
        />
        <SummaryCard
          label="已完成"
          value={data.summary.completed_patient_count}
          icon={CheckCircle2}
          tone="sage"
        />
        <SummaryCard
          label="待處理回報"
          value={data.summary.pending_report_count}
          icon={Megaphone}
          tone="rust"
        />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* 今日病患 */}
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-bark-700">今日病患</h2>
            <FilterChips
              options={statusFilters}
              active={filter}
              onChange={setFilter}
              layoutId="dash-status-filter"
            />
          </div>

          {patients.length === 0 ? (
            <EmptyState message="沒有符合條件的病患" />
          ) : (
            <ul className="divide-y divide-sand/70">
              {patients.map((p, i) => (
                <motion.li
                  key={p.visit_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-[8rem]">
                    <p className="text-sm font-medium text-bark-700">{p.patient_name}</p>
                    <p className="text-xs text-bark-300">{p.patient_number}</p>
                  </div>
                  <StatusBadge
                    status={p.visit_type}
                    label={visitTypeLabel[p.visit_type] ?? p.visit_type}
                  />
                  <StatusBadge
                    status={p.status}
                    label={visitStatusLabel[p.status] ?? p.status}
                  />
                  <div className="ml-auto hidden text-right text-xs text-bark-400 sm:block">
                    <p>最近看診：{formatDate(p.last_visit_date)}</p>
                    <p>復健狀態：{rehabStatusLabel[p.rehab_status] ?? p.rehab_status}</p>
                  </div>
                  <Link to={`/doctor/patients/${p.patient_id}`} className="btn-ghost">
                    查看病患
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {/* 護理師回報 */}
          {data.pending_reports.length > 0 && (
            <section className="card border-rust/25 p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-bark-700">
                <Megaphone size={17} className="text-rust" />
                護理師回報
              </h2>
              <ul className="space-y-3.5">
                {data.pending_reports.map((rep, i) => (
                  <motion.li
                    key={rep.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-xl bg-[#FBF5F3] p-4"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-bark-700">
                        {rep.patient_name}
                      </span>
                      <StatusBadge status={rep.kind} label={reportKindLabel[rep.kind]} />
                      {rep.severity !== 'NORMAL' && (
                        <StatusBadge
                          status={rep.severity}
                          label={severityLabel[rep.severity] ?? rep.severity}
                        />
                      )}
                    </div>
                    <p className="text-xs text-bark-400">
                      {rep.plan_name}・{rep.nurse_name}・{formatDateTime(rep.created_at)}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-bark-600">{rep.content}</p>
                    <div className="mt-2.5 flex gap-2">
                      <Link
                        to={`/doctor/rehabilitation-plans/${rep.plan_id}`}
                        className="btn-ghost text-xs"
                      >
                        查看計畫
                      </Link>
                      <button
                        onClick={() => {
                          setReplying(rep)
                          setComment('')
                        }}
                        className="btn-ghost text-xs text-sage-600 hover:bg-sage-50"
                      >
                        回覆並結案
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </section>
          )}

          {/* 需要評估的復健計畫 */}
          <section className="card p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-bark-700">
              <ClipboardList size={17} className="text-clay-500" />
              需要評估的復健計畫
            </h2>
            {data.plan_reminders.length === 0 ? (
              <EmptyState message="目前沒有需要評估的計畫" />
            ) : (
              <ul className="space-y-3.5">
                {data.plan_reminders.map((r, i) => (
                  <motion.li
                    key={r.plan_id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-xl bg-parchment/60 p-4"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-bark-700">{r.patient_name}</span>
                      <StatusBadge
                        status={r.status}
                        label={rehabStatusLabel[r.status] ?? r.status}
                      />
                    </div>
                    <p className="text-xs text-bark-400">{r.plan_name}</p>
                    <p className="mt-1 text-xs text-bark-400">
                      {r.reason} · 評估日期：{formatDate(r.evaluation_date)}
                    </p>
                    <Link
                      to={`/doctor/rehabilitation-plans/${r.plan_id}`}
                      className="btn-ghost mt-2 text-xs"
                    >
                      查看計畫
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* 回覆回報 Dialog */}
      <Dialog open={replying !== null} onOpenChange={(open) => !open && setReplying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回覆護理師回報</DialogTitle>
            <DialogDescription>
              {replying &&
                `${replying.patient_name}・${replying.plan_name}・${replying.nurse_name}`}
            </DialogDescription>
          </DialogHeader>
          {replying && (
            <p className="rounded-xl bg-parchment/70 p-4 text-sm leading-relaxed text-bark-600">
              {replying.content}
            </p>
          )}
          <div>
            <span className="label">醫生回覆（選填）</span>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="例如：收到，先暫停核心訓練，安排回診評估。"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplying(null)}>
              取消
            </Button>
            <Button onClick={submitReply} disabled={saving}>
              {saving ? '送出中…' : '確認處理'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}
