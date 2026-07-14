import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Film, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiErrorMessage } from '../../../api/client'
import {
  adjustPlan,
  createPlan,
  getPatient,
  getPlan,
  listNurses,
} from '../../../api/doctor'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import type { PlanItemInput, PlanItemTeacherVideo } from '../../../types'

interface Props {
  mode: 'create' | 'adjust'
}

/** 表單列 = 送出欄位 + 顯示用導師影片資訊（護理師綁定，醫生端唯讀沿用） */
type FormItem = PlanItemInput & { teacherVideo?: PlanItemTeacherVideo | null }

const emptyItem: FormItem = {
  name: '',
  frequency: '',
  times_per_week: 3,
  description: '',
  precaution: '',
  example_video_url: null,
  example_video_note: null,
  teacher_video_id: null,
}

/** 建立 / 調整復健計畫共用表單 */
export function PlanFormPage({ mode }: Props) {
  const { patientId, planId } = useParams()
  const navigate = useNavigate()

  const [loaded, setLoaded] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [targetPatientId, setTargetPatientId] = useState<number | null>(null)
  const [nurses, setNurses] = useState<{ id: number; name: string }[]>([])

  const [name, setName] = useState('')
  const [goals, setGoals] = useState<string[]>([''])
  const [items, setItems] = useState<FormItem[]>([{ ...emptyItem }])
  const [nurseId, setNurseId] = useState<number | ''>('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [evaluationDate, setEvaluationDate] = useState('')
  const [changeSummary, setChangeSummary] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listNurses().then(setNurses)
    if (mode === 'create' && patientId) {
      getPatient(patientId).then((p) => {
        setPatientName(p.basic.name)
        setTargetPatientId(p.basic.id)
        setLoaded(true)
      })
    } else if (mode === 'adjust' && planId) {
      getPlan(planId).then((plan) => {
        setPatientName(plan.patient_name)
        setName(plan.name)
        const current = plan.current_version
        if (current) {
          setGoals(current.goals.length ? current.goals : [''])
          setItems(
            current.items.length
              ? current.items.map((i) => ({
                  name: i.name,
                  frequency: i.frequency ?? '',
                  times_per_week: i.times_per_week,
                  description: i.description ?? '',
                  precaution: i.precaution ?? '',
                  example_video_url: i.example_video_url,
                  example_video_note: i.example_video_note,
                  teacher_video_id: i.teacher_video?.id ?? null,
                  teacherVideo: i.teacher_video ?? null,
                }))
              : [{ ...emptyItem }],
          )
        }
        setEvaluationDate(plan.evaluation_date ?? '')
        setLoaded(true)
      })
    }
  }, [mode, patientId, planId])

  if (!loaded) return <Loading />

  const backTo =
    mode === 'create' ? `/doctor/patients/${patientId}` : `/doctor/rehabilitation-plans/${planId}`

  const updateItem = (index: number, field: keyof PlanItemInput, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanGoals = goals.map((g) => g.trim()).filter(Boolean)
    const cleanItems: PlanItemInput[] = items
      .filter((i) => i.name.trim())
      .map(({ teacherVideo: _tv, ...fields }) => fields)
    if (cleanGoals.length === 0) return setError('請至少填寫一項復健目標')
    if (cleanItems.length === 0) return setError('請至少填寫一個復健項目')

    setSubmitting(true)
    try {
      if (mode === 'create') {
        if (!targetPatientId) return
        const result = await createPlan(targetPatientId, {
          name,
          goals: cleanGoals,
          items: cleanItems,
          nurse_id: nurseId === '' ? null : nurseId,
          start_date: startDate,
          evaluation_date: evaluationDate || null,
        })
        navigate(`/doctor/rehabilitation-plans/${result.id}`)
      } else {
        if (!planId) return
        if (!changeSummary.trim()) {
          setError('請填寫本次調整摘要')
          setSubmitting(false)
          return
        }
        await adjustPlan(planId, {
          change_summary: changeSummary,
          goals: cleanGoals,
          items: cleanItems,
          evaluation_date: evaluationDate || null,
        })
        navigate(`/doctor/rehabilitation-plans/${planId}`)
      }
    } catch (err) {
      setError(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <PageTransition>
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-bark-400 transition-colors hover:text-clay-600"
      >
        <ArrowLeft size={15} /> 返回
      </Link>

      <PageHeader
        title={mode === 'create' ? '建立復健計畫' : '調整復健計畫'}
        subtitle={
          mode === 'create'
            ? `為 ${patientName} 建立新的復健計畫`
            : `調整 ${patientName} 的「${name}」，將產生新版本`
        }
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="card space-y-5 p-6">
          {mode === 'adjust' && (
            <div>
              <label className="label">
                本次調整摘要 <span className="text-rust">*</span>
              </label>
              <textarea
                className="input min-h-[64px] resize-y"
                placeholder="例如：核心訓練由每週 3 次調整為每週 2 次"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">計畫名稱</label>
            <input
              className="input"
              placeholder="例如：腰椎復健計畫"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={mode === 'adjust'}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {mode === 'create' && (
              <>
                <div>
                  <label className="label">負責治療人員</label>
                  <select
                    className="input"
                    value={nurseId}
                    onChange={(e) => setNurseId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">請選擇</option>
                    {nurses.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">開始日期</label>
                  <input
                    type="date"
                    className="input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className="label">預計評估日期</label>
              <input
                type="date"
                className="input"
                value={evaluationDate}
                onChange={(e) => setEvaluationDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 復健目標 */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <label className="label mb-0">復健目標</label>
            <button
              type="button"
              onClick={() => setGoals([...goals, ''])}
              className="btn-ghost text-xs"
            >
              <Plus size={14} /> 新增目標
            </button>
          </div>
          <div className="space-y-2.5">
            {goals.map((goal, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-100 text-xs font-semibold text-sage-700">
                  {i + 1}
                </span>
                <input
                  className="input"
                  placeholder="例如：提升腰部活動度"
                  value={goal}
                  onChange={(e) =>
                    setGoals(goals.map((g, gi) => (gi === i ? e.target.value : g)))
                  }
                />
                {goals.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setGoals(goals.filter((_, gi) => gi !== i))}
                    className="rounded-lg p-2 text-bark-300 transition-colors hover:bg-[#F7E8E4] hover:text-rust"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* 復健項目 */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <label className="label mb-0">復健項目</label>
            <button
              type="button"
              onClick={() => setItems([...items, { ...emptyItem }])}
              className="btn-ghost text-xs"
            >
              <Plus size={14} /> 新增項目
            </button>
          </div>
          <div className="space-y-4">
            {items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-sand p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="input"
                    placeholder="項目名稱（例如：腰部伸展）"
                    value={item.name}
                    onChange={(e) => updateItem(i, 'name', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="頻率（例如：每週 3 次）"
                    value={item.frequency ?? ''}
                    onChange={(e) => updateItem(i, 'frequency', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="執行方式（例如：每次 15 分鐘）"
                    value={item.description ?? ''}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="注意事項（例如：動作不穩時先暫停）"
                    value={item.precaution ?? ''}
                    onChange={(e) => updateItem(i, 'precaution', e.target.value)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <label className="flex items-center gap-2 text-xs text-bark-400">
                    每週次數（計入完成率）
                    <input
                      type="number"
                      min={1}
                      max={14}
                      className="input w-20"
                      value={item.times_per_week ?? 3}
                      onChange={(e) => updateItem(i, 'times_per_week', Number(e.target.value))}
                    />
                  </label>
                  {item.teacherVideo && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full bg-sage-100 px-3 py-1.5 text-xs text-sage-700"
                      title="導師影片由治療人員管理，會跟隨此項目沿用至新版本"
                    >
                      <Film size={13} />
                      導師影片：{item.teacherVideo.name ?? `#${item.teacherVideo.id}`}
                      <span className="text-sage-700/60">（沿用至新版本）</span>
                    </span>
                  )}
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, ii) => ii !== i))}
                    className="btn-ghost mt-2 text-xs text-rust hover:bg-[#F7E8E4]"
                  >
                    <Trash2 size={13} /> 移除此項目
                  </button>
                )}
              </motion.div>
            ))}
          </div>
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

        <div className="flex justify-end gap-3">
          <Link to={backTo} className="btn-secondary">
            取消
          </Link>
          <button className="btn-primary" disabled={submitting}>
            {submitting ? '儲存中…' : mode === 'create' ? '建立計畫' : '儲存調整（產生新版本）'}
          </button>
        </div>
      </form>
    </PageTransition>
  )
}
