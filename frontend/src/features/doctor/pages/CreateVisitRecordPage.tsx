import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  ClipboardCheck,
  FilePlus2,
  FlagTriangleRight,
  MessageSquareText,
  Repeat,
  Settings2,
  Stethoscope,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../../../api/client'
import { createVisit, getPatient } from '../../../api/doctor'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { PatientDetail } from '../../../types'
import { genderLabel, rehabDecisionLabel, rehabStatusLabel } from '../../../utils/format'

interface DecisionOption {
  key: string
  icon: LucideIcon
  /** icon 泡泡配色 */
  tone: string
  hint: string
}

// 五種復健決策選項。後端只對 END_PLAN 有副作用（結束目前計畫）；
// CREATE_PLAN / ADJUST_PLAN 是由前端在儲存後導向對應表單完成，看診紀錄本身只記錄決策
const decisions: DecisionOption[] = [
  { key: 'NO_REHAB', icon: Ban, tone: 'bg-parchment text-bark-500', hint: '本次不安排復健，持續觀察' },
  { key: 'CREATE_PLAN', icon: FilePlus2, tone: 'bg-clay-50 text-clay-600', hint: '為病患建立新的居家復健計畫' },
  { key: 'CONTINUE_PLAN', icon: Repeat, tone: 'bg-sage-50 text-sage-700', hint: '維持目前計畫內容不變' },
  { key: 'ADJUST_PLAN', icon: Settings2, tone: 'bg-[#FBF3E2] text-[#A87A24]', hint: '調整目前計畫的動作或強度' },
  { key: 'END_PLAN', icon: FlagTriangleRight, tone: 'bg-[#F7E8E4] text-rust', hint: '結束目前的復健計畫' },
]

/**
 * 醫師端新增看診紀錄頁：主訴/診斷/評估三欄位 + 復健決策單選 + 選填回診日。
 * 決策選項依「是否已有進行中計畫」動態鎖定，避免建立第二份有效計畫或操作不存在的計畫。
 */
export function CreateVisitRecordPage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientDetail | null>(null)
  const [chief, setChief] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [assessment, setAssessment] = useState('')
  const [decision, setDecision] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (patientId) getPatient(patientId).then(setPatient)
  }, [patientId])

  if (!patient) return <Loading />

  // 互斥規則：已有進行中計畫就不能再「建立」；沒有計畫則「繼續/調整/結束」都無對象可操作
  const hasActivePlan = patient.current_plan !== null
  const decisionDisabled = (d: string) =>
    (d === 'CREATE_PLAN' && hasActivePlan) ||
    (['CONTINUE_PLAN', 'ADJUST_PLAN', 'END_PLAN'].includes(d) && !hasActivePlan)

  /**
   * 儲存看診紀錄後依決策分流：CREATE_PLAN → 建立計畫表單、
   * ADJUST_PLAN → 目前計畫的調整表單、其餘 → 回病患詳情頁。
   * 成功路徑不重置 submitting——按鈕保持鎖定直到導頁完成，防止重複送出。
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!patientId || !decision) return
    setError('')
    setSubmitting(true)
    try {
      await createVisit(patientId, {
        chief_complaint: chief,
        diagnosis,
        assessment,
        rehab_decision: decision,
        follow_up_date: followUp || null,
      })
      if (decision === 'CREATE_PLAN') {
        navigate(`/doctor/patients/${patientId}/rehabilitation-plans/new`)
      } else if (decision === 'ADJUST_PLAN' && patient.current_plan) {
        navigate(`/doctor/rehabilitation-plans/${patient.current_plan.id}/adjust`)
      } else {
        navigate(`/doctor/patients/${patientId}`)
      }
    } catch (err) {
      setError(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <Link
        to={`/doctor/patients/${patientId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回病患詳細資料
      </Link>

      <PageHeader title="新增看診記錄" subtitle="完成本次看診紀錄並決定復健方向" />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {/* 病患資訊（唯讀） */}
        <div className="card flex items-center gap-4 bg-gradient-to-r from-parchment/70 to-clay-50/60 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 text-lg font-semibold text-sage-700 shadow-soft">
            {patient.basic.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-bark-700">{patient.basic.name}</p>
            <p className="text-xs text-bark-400">
              {patient.basic.patient_number} · {patient.basic.age} 歲 /{' '}
              {genderLabel[patient.basic.gender]}
            </p>
          </div>
          <StatusBadge
            status={patient.rehab_status}
            label={rehabStatusLabel[patient.rehab_status] ?? patient.rehab_status}
          />
        </div>

        <div className="card space-y-5 p-6">
          <div className="flex items-center gap-2.5 border-b border-sand/60 pb-4">
            <div className="rounded-lg bg-clay-50 p-2 text-clay-600">
              <Stethoscope size={16} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-bark-700">診療紀錄</h3>
              <p className="text-[11px] text-bark-300">記錄本次看診的主訴、診斷與評估</p>
            </div>
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <MessageSquareText size={13} className="text-clay-500" /> 病患主訴
            </label>
            <p className="mb-1.5 text-[11px] text-bark-300">病患自述的不適部位、症狀與持續時間</p>
            <textarea
              className="input min-h-[88px] resize-y"
              placeholder="描述病患本次的主要不適與症狀…"
              value={chief}
              onChange={(e) => setChief(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <Stethoscope size={13} className="text-clay-500" /> 醫師診斷
            </label>
            <p className="mb-1.5 text-[11px] text-bark-300">本次看診的臨床診斷結果</p>
            <textarea
              className="input min-h-[64px] resize-y"
              placeholder="本次診斷結果…"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <ClipboardCheck size={13} className="text-clay-500" /> 醫師評估
            </label>
            <p className="mb-1.5 text-[11px] text-bark-300">治療方向、預後與後續建議</p>
            <textarea
              className="input min-h-[88px] resize-y"
              placeholder="治療方向與評估建議…"
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label flex items-center gap-1.5">
              <CalendarClock size={13} className="text-clay-500" /> 預約回診日期（選填）
            </label>
            <input
              type="date"
              className="input max-w-xs"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
            />
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-bark-700">本次復健決策</h3>
            <p className="mt-0.5 text-[11px] text-bark-300">依病患狀況選擇後續的復健方向</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {decisions.map((d, index) => {
              const disabled = decisionDisabled(d.key)
              const selected = decision === d.key
              // 五個選項排兩欄會剩一個孤兒卡，最後一張奇數卡橫跨整列補滿版面
              const isLastOdd = index === decisions.length - 1 && decisions.length % 2 === 1
              return (
                <motion.label
                  key={d.key}
                  whileHover={disabled ? undefined : { y: -2 }}
                  className={`relative flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                    selected ? 'border-clay-400 bg-clay-50 shadow-soft' : 'border-sand bg-white'
                  } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:border-clay-300'} ${
                    isLastOdd ? 'sm:col-span-2' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="decision"
                    value={d.key}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => setDecision(d.key)}
                    className="sr-only"
                  />
                  <div className={`shrink-0 rounded-lg p-2 ${d.tone}`}>
                    <d.icon size={16} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 pr-6">
                    <p className="text-sm font-medium text-bark-700">{rehabDecisionLabel[d.key]}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-bark-300">
                      {d.key === 'CREATE_PLAN' && hasActivePlan ? '已有進行中計畫' : d.hint}
                    </p>
                  </div>
                  <AnimatePresence>
                    {selected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-clay-500 text-white"
                      >
                        <Check size={12} strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.label>
              )
            })}
          </div>
          {decision === 'CREATE_PLAN' && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl bg-sage-50 px-4 py-2.5 text-xs text-sage-700"
            >
              儲存後將導向建立復健計畫表單
            </motion.p>
          )}
          {decision === 'ADJUST_PLAN' && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-xl bg-sage-50 px-4 py-2.5 text-xs text-sage-700"
            >
              儲存後將導向目前計畫的調整流程
            </motion.p>
          )}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-[#F7E8E4] px-4 py-3 text-sm text-rust"
          >
            {error}
          </motion.p>
        )}

        <div className="sticky bottom-0 -mx-2 flex justify-end gap-3 rounded-t-2xl bg-cream/80 px-2 py-3 backdrop-blur">
          <Link to={`/doctor/patients/${patientId}`} className="btn-secondary">
            取消
          </Link>
          <button className="btn-primary" disabled={submitting || !decision}>
            {submitting ? '儲存中…' : '儲存看診記錄'}
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
