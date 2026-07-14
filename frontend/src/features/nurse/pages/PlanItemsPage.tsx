import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Clapperboard,
  FolderOpen,
  Lock,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import {
  addPlanItem,
  deletePlanItem,
  getPlanItems,
  updatePlanItem,
} from '../../../api/nurse'
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
import { Input } from '../../../components/ui/input'
import { Loading } from '../../../components/ui/Loading'
import { PageTransition } from '../../../components/ui/PageTransition'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Textarea } from '../../../components/ui/textarea'
import type { PlanItem, PlanItemInput, PlanItemsView, TeacherVideo } from '../../../types'
import { rehabStatusLabel, withRole } from '../../../utils/format'
import { TeacherVideoCard } from '../components/TeacherVideoCard'
import { TeacherVideoPickerDialog } from '../components/TeacherVideoPickerDialog'

const emptyForm: PlanItemInput = {
  name: '',
  frequency: '',
  times_per_week: 3,
  description: '',
  precaution: '',
  example_video_url: '',
  example_video_note: '',
}

export function PlanItemsPage() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<PlanItemsView | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PlanItem | null>(null)
  const [form, setForm] = useState<PlanItemInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  // 新增動作時從影片庫預選的導師影片（編輯模式在動作卡片上操作）
  const [selectedTv, setSelectedTv] = useState<TeacherVideo | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (planId) getPlanItems(planId).then(setData)
  }, [planId])

  if (!data) return <Loading />
  const isActive = ['ONGOING', 'PENDING_EVALUATION'].includes(data.plan_status)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setSelectedTv(null)
    setDialogOpen(true)
  }

  const openEdit = (item: PlanItem) => {
    setEditing(item)
    setForm({
      name: item.name,
      frequency: item.frequency ?? '',
      times_per_week: item.times_per_week,
      description: item.description ?? '',
      precaution: item.precaution ?? '',
      example_video_url: item.example_video_url ?? '',
      example_video_note: item.example_video_note ?? '',
    })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name?.trim()) {
      toast.error('請填寫動作名稱')
      return
    }
    setSaving(true)
    const payload: PlanItemInput = {
      ...form,
      frequency: form.frequency || null,
      description: form.description || null,
      precaution: form.precaution || null,
      example_video_url: form.example_video_url || null,
      example_video_note: form.example_video_note || null,
    }
    // 只有新增動作會帶影片庫預選；編輯模式的影片切換在動作卡片上進行
    if (!editing && selectedTv) payload.teacher_video_id = selectedTv.id
    try {
      const next = editing
        ? await updatePlanItem(data.plan_id, editing.id, payload)
        : await addPlanItem(data.plan_id, payload)
      setData(next)
      setDialogOpen(false)
      toast.success(editing ? '動作已更新' : '動作已新增')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item: PlanItem) => {
    try {
      const next = await deletePlanItem(data.plan_id, item.id)
      setData(next)
      toast.success('動作已刪除')
    } catch (err) {
      toast.error(apiErrorMessage(err))
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

      <div className="mx-auto max-w-4xl space-y-6">
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-semibold text-bark-700">
                  {data.plan_name}
                </h1>
                <span className="text-xs text-bark-300">V{data.version}</span>
                <StatusBadge
                  status={data.plan_status}
                  label={rehabStatusLabel[data.plan_status] ?? data.plan_status}
                />
              </div>
              <p className="mt-1.5 text-sm text-bark-400">
                病患：
                <Link
                  to={`/nurse/patients/${data.patient_id}`}
                  className="text-clay-600 hover:underline"
                >
                  {data.patient_name}
                </Link>
                <span className="ml-1 text-xs">{data.patient_number}</span>
              </p>
            </div>
            {isActive && (
              <Button onClick={openCreate}>
                <Plus size={16} /> 新增復健動作
              </Button>
            )}
          </div>

          {data.goals.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Target size={14} className="text-clay-500" />
              {data.goals.map((g) => (
                <span key={g} className="rounded-lg bg-parchment px-2.5 py-1 text-xs text-bark-600">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isActive && (
          <div className="flex items-center gap-2.5 rounded-xl border border-sand bg-parchment/60 px-4 py-3 text-sm text-bark-500">
            <Lock size={15} className="shrink-0 text-bark-300" />
            此計畫已結束，內容僅供查看，無法新增或修改復健動作。
          </div>
        )}

        {data.items.length === 0 ? (
          <div className="card p-6">
            <EmptyState
              message={isActive
                ? '尚未制定復健動作，點右上角「新增復健動作」開始。'
                : '此計畫沒有復健動作紀錄。'}
            />
          </div>
        ) : (
          <ul className="space-y-4">
            {data.items.map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="card card-hover p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-base font-semibold text-bark-700">{item.name}</p>
                      {item.frequency && (
                        <span className="rounded-lg bg-sage-100 px-2 py-0.5 text-xs text-sage-700">
                          {item.frequency}
                        </span>
                      )}
                      <span className="text-xs text-bark-300">
                        每週 {item.times_per_week} 次計入完成率
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-1.5 text-sm text-bark-500">{item.description}</p>
                    )}
                    {item.precaution && (
                      <p className="mt-1.5 text-xs text-rust">注意：{item.precaution}</p>
                    )}

                    {item.example_video_note && (
                      <p className="mt-2 text-xs text-bark-400">
                        影片重點：{item.example_video_note}
                      </p>
                    )}
                    {isActive ? (
                      <TeacherVideoCard
                        planId={data.plan_id}
                        item={item}
                        onChanged={() => getPlanItems(data.plan_id).then(setData)}
                      />
                    ) : item.teacher_video ? (
                      <p className="mt-3 text-xs text-bark-400">
                        導師影片：{item.teacher_video.name ?? `影片 #${item.teacher_video.id}`}
                      </p>
                    ) : null}
                  </div>
                  {isActive && (
                    <div className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
                        <Pencil size={13} /> 編輯
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rust hover:bg-[#FBF5F3]"
                        onClick={() => remove(item)}
                      >
                        <Trash2 size={13} /> 刪除
                      </Button>
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? '編輯復健動作' : '新增復健動作'}</DialogTitle>
            <DialogDescription>
              病患將在自己的計畫頁看到動作說明與範例影片，並依此拍攝居家復健影片。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div>
                <span className="label">動作名稱 *</span>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：核心橋式"
                />
              </div>
              <div>
                <span className="label">每週次數</span>
                <Input
                  type="number"
                  min={1}
                  max={14}
                  value={form.times_per_week ?? 3}
                  onChange={(e) => setForm({ ...form, times_per_week: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <span className="label">頻率說明</span>
              <Input
                value={form.frequency ?? ''}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                placeholder="例如：每週 3 次"
              />
            </div>
            <div>
              <span className="label">動作說明</span>
              <Textarea
                value={form.description ?? ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="組數、次數與動作要領…"
                rows={2}
              />
            </div>
            <div>
              <span className="label">注意事項</span>
              <Input
                value={form.precaution ?? ''}
                onChange={(e) => setForm({ ...form, precaution: e.target.value })}
                placeholder="例如：動作放慢，避免快速扭轉"
              />
            </div>
            <div className="rounded-xl border border-dashed border-sand bg-parchment/40 p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-bark-500">
                <Clapperboard size={13} /> 導師影片
              </p>
              {editing ? (
                <p className="mb-3 text-xs text-bark-300">
                  導師影片請在動作卡片上「從影片庫選擇」或直接上傳
                </p>
              ) : selectedTv ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-50 px-3 py-1.5 text-xs font-medium text-clay-700">
                    <Clapperboard size={12} />
                    {selectedTv.name ?? selectedTv.original_filename ?? `影片 #${selectedTv.id}`}
                    <button
                      type="button"
                      className="rounded-full p-0.5 transition-colors hover:bg-clay-100"
                      onClick={() => setSelectedTv(null)}
                      aria-label="清除已選影片"
                    >
                      <X size={12} />
                    </button>
                  </span>
                  {selectedTv.uploader_name && (
                    <span className="text-[11px] text-bark-300">
                      {withRole(selectedTv.uploader_name, 'nurse')} 上傳
                    </span>
                  )}
                </div>
              ) : (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                  >
                    <FolderOpen size={13} /> 從影片庫選擇
                  </Button>
                  <span className="text-[11px] text-bark-300">
                    也可先建立動作，再於動作卡片上直接上傳
                  </span>
                </div>
              )}
              <Input
                value={form.example_video_note ?? ''}
                onChange={(e) => setForm({ ...form, example_video_note: e.target.value })}
                placeholder="影片重點說明，例如：臀部抬起時停留 3 秒"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? '儲存中…' : editing ? '儲存變更' : '新增動作'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TeacherVideoPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(v) => {
          setSelectedTv(v)
          setPickerOpen(false)
        }}
        currentId={selectedTv?.id}
      />
    </PageTransition>
  )
}
