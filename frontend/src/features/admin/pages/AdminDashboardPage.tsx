import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  HardDrive,
  MonitorPlay,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  Video,
} from 'lucide-react'
import { getOverview } from '../../../api/admin'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition, staggerContainer } from '../../../components/ui/PageTransition'
import { SummaryCard } from '../../../components/ui/SummaryCard'
import type { AdminOverview } from '../../../types'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverview | null>(null)

  useEffect(() => {
    getOverview().then(setData)
  }, [])

  if (!data) return <Loading />

  const role = (key: string) => data.users[key] ?? { total: 0, active: 0 }
  const disk = data.media_disk
  const diskUsedRatio = (disk.disk_total_bytes - disk.disk_free_bytes) / disk.disk_total_bytes

  return (
    <PageTransition>
      <PageHeader title="系統總覽" subtitle="帳號、影片分析與儲存空間狀態" />

      <p className="mb-3 text-xs font-medium tracking-wide text-bark-400">帳號</p>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <SummaryCard
          label="醫師"
          value={role('doctor').total}
          icon={Stethoscope}
          tone="clay"
          hint={`啟用中 ${role('doctor').active}`}
        />
        <SummaryCard
          label="護理師"
          value={role('nurse').total}
          icon={Users}
          tone="sage"
          hint={`啟用中 ${role('nurse').active}`}
        />
        <SummaryCard
          label="病患"
          value={role('patient').total}
          icon={UserRound}
          tone="amber"
          hint={`啟用中 ${role('patient').active}`}
        />
        <SummaryCard
          label="管理員"
          value={role('admin').total}
          icon={ShieldCheck}
          tone="bark"
          hint={`啟用中 ${role('admin').active}`}
        />
      </motion.div>

      <p className="mb-3 text-xs font-medium tracking-wide text-bark-400">影片與分析</p>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <SummaryCard label="影片繳交總數" value={data.submissions_total} icon={Video} tone="clay" />
        <SummaryCard
          label="待審核"
          value={data.pending_review}
          icon={MonitorPlay}
          tone="amber"
        />
        <SummaryCard
          label="分析完成"
          value={data.analysis.done}
          icon={CheckCircle2}
          tone="sage"
          hint={
            data.analysis.in_progress + data.analysis.pending > 0
              ? `進行中/排隊 ${data.analysis.in_progress + data.analysis.pending}`
              : undefined
          }
        />
        <SummaryCard label="分析失敗" value={data.analysis.failed} icon={AlertCircle} tone="rust" />
      </motion.div>

      <p className="mb-3 text-xs font-medium tracking-wide text-bark-400">儲存空間</p>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card flex flex-wrap items-center gap-6 p-6"
      >
        <div className="rounded-xl bg-parchment p-3 text-bark-500">
          <HardDrive size={22} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-bark-400">
              影片與分析資料佔用{' '}
              <span className="text-lg font-semibold text-bark-700">
                {formatBytes(disk.media_bytes)}
              </span>
            </p>
            <p className="text-xs text-bark-300">
              磁碟剩餘 {formatBytes(disk.disk_free_bytes)} / 共 {formatBytes(disk.disk_total_bytes)}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-parchment">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(diskUsedRatio * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`h-full rounded-full ${diskUsedRatio > 0.9 ? 'bg-rust' : 'bg-sage-400'}`}
            />
          </div>
          <p className="mt-1.5 text-xs text-bark-300">
            磁碟使用率 {(diskUsedRatio * 100).toFixed(1)}% ·
            含病患上傳影片、導師示範影片與演算法分析產物
          </p>
        </div>
      </motion.div>
    </PageTransition>
  )
}
