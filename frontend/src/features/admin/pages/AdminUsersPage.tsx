import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, Pencil, Plus, Trash2, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  setActive,
  updateUser,
} from '../../../api/admin'
import { apiErrorMessage } from '../../../api/client'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import { SearchBar } from '../../../components/ui/SearchBar'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useAuth } from '../../../contexts/AuthContext'
import type { AdminUser, AdminUserCreateInput } from '../../../types'
import { formatDate } from '../../../utils/format'
import { roleLabel } from '../labels'

const roleFilters = [
  { key: 'ALL', label: '全部' },
  { key: 'doctor', label: '醫師' },
  { key: 'nurse', label: '護理師' },
  { key: 'patient', label: '病患' },
  { key: 'admin', label: '管理員' },
]

/** 操作列圖示按鈕：滑鼠停留顯示文字提示 */
function ActionButton({
  label,
  danger = false,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`btn-ghost px-2 py-1.5 ${danger ? 'text-rust hover:text-rust' : ''}`}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

// 新增帳號表單初始值：role 不含 admin（後端禁止建立第二個管理員），
// 病患專屬欄位（病歷號/生日/性別/電話）只在 role=patient 時顯示與送出
const emptyCreateForm = {
  username: '',
  password: '',
  role: 'doctor' as 'doctor' | 'nurse' | 'patient',
  name: '',
  title: '',
  patient_number: '',
  birth_date: '',
  gender: 'MALE',
  phone: '',
}

/**
 * 管理員帳號管理頁：帳號 CRUD、密碼重設、停用/啟用。
 * 「刪除」遵循後端軟刪除優先規則：帳號有關聯資料（看診/計畫/影片）時自動降級為停用，
 * 前端依 has_related_data 預先在確認對話框說明實際會發生的行為。
 * 自己與 admin 帳號鎖定停用/刪除操作（與後端限制一致，避免自斷後路）。
 */
export function AdminUsersPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')

  // 四個對話框各自獨立的目標與表單狀態；*Target 非 null 即代表該對話框開啟
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null)
  const [editForm, setEditForm] = useState({ name: '', title: '', phone: '' })
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetValue, setResetValue] = useState('1234')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  // 共用的送出中旗標：四個對話框同一時間只會開一個，共用不會互相干擾
  const [submitting, setSubmitting] = useState(false)

  const reload = () => listUsers().then(setUsers)

  useEffect(() => {
    reload()
  }, [])

  // 搜尋/角色篩選在前端做——帳號總數僅數十筆，一次撈全量比每敲一字打 API 划算。
  // 搜尋同時比對姓名（區分大小寫無意義的中文）、帳號與病歷號（皆不分大小寫）
  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (
        search &&
        !u.name.includes(search) &&
        !u.username.toLowerCase().includes(search.toLowerCase()) &&
        !(u.patient_number ?? '').toLowerCase().includes(search.toLowerCase())
      )
        return false
      return true
    })
  }, [users, search, roleFilter])

  /**
   * 建立帳號：密碼留空時沿用系統慣例預設 1234；
   * 病患角色額外附上 patient_profile（後端會同時建立 Patient 列）。
   */
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload: AdminUserCreateInput = {
        username: createForm.username.trim(),
        password: createForm.password || '1234',
        role: createForm.role,
        name: createForm.name.trim(),
        title: createForm.title.trim() || null,
      }
      if (createForm.role === 'patient') {
        payload.patient_profile = {
          patient_number: createForm.patient_number.trim(),
          birth_date: createForm.birth_date,
          gender: createForm.gender,
          phone: createForm.phone.trim() || null,
        }
      }
      await createUser(payload)
      toast.success(`帳號 ${payload.username} 已建立`)
      setCreateOpen(false)
      setCreateForm(emptyCreateForm)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  /** 更新姓名/職稱（病患另可改電話）；role 依系統規則不可變更，表單不提供。 */
  const handleEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSubmitting(true)
    try {
      // FIXME: 電話留空時仍會送出空字串，後端 update_user 只判斷 is not None，
      // 會把病患電話清成空字串——與欄位標示「留空不變更」不符（應改為空值時不帶 phone 欄位）
      await updateUser(editTarget.id, {
        name: editForm.name.trim(),
        title: editForm.title.trim(),
        ...(editTarget.role === 'patient' ? { phone: editForm.phone.trim() } : {}),
      })
      toast.success('已更新帳號資料')
      setEditTarget(null)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  /** 重設密碼：不強制複雜度（原型階段），留空回預設 1234。 */
  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!resetTarget) return
    setSubmitting(true)
    try {
      await resetPassword(resetTarget.id, resetValue || '1234')
      toast.success(`${resetTarget.username} 的密碼已重設`)
      setResetTarget(null)
      setResetValue('1234')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  /** 停用/啟用切換。副作用：停用後該帳號立即無法登入、所有 API 皆被擋。 */
  const handleToggleActive = async (u: AdminUser) => {
    try {
      await setActive(u.id, !u.is_active)
      toast.success(u.is_active ? `${u.username} 已停用` : `${u.username} 已重新啟用`)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  /**
   * 刪除帳號。後端決定實際行為：無關聯資料 → 真刪（不可復原）；
   * 有關聯資料 → 自動降級為停用。以回傳的 deleted 旗標區分 toast 樣式。
   */
  const handleDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      const result = await deleteUser(deleteTarget.id)
      if (result.deleted) toast.success(result.detail)
      else toast.info(result.detail)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!users) return <Loading />

  return (
    <TooltipProvider delayDuration={150}>
    <PageTransition testId="admin-users">
      <PageHeader
        title="帳號管理"
        subtitle="建立、停用與維護系統帳號"
        actions={
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            新增帳號
          </button>
        }
      />

      <div className="card mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="w-72 max-w-full">
            <SearchBar value={search} onChange={setSearch} placeholder="搜尋帳號、姓名、病歷號" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-bark-400">角色</span>
            <FilterChips
              options={roleFilters}
              active={roleFilter}
              onChange={setRoleFilter}
              layoutId="admin-user-role"
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState message="找不到符合條件的帳號" hint="請調整搜尋或篩選條件" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/50 text-left text-xs text-bark-400">
                  <th className="px-5 py-3.5 font-medium">帳號</th>
                  <th className="px-5 py-3.5 font-medium">病歷號</th>
                  <th className="px-5 py-3.5 font-medium">角色</th>
                  <th className="px-5 py-3.5 font-medium">姓名 / 職稱</th>
                  <th className="px-5 py-3.5 font-medium">建立日期</th>
                  <th className="px-5 py-3.5 font-medium">狀態</th>
                  <th className="px-5 py-3.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  // 自己與 admin 帳號不給停用/刪除（與後端規則一致），僅保留編輯與重設密碼
                  const isSelf = u.username === me?.username
                  const locked = isSelf || u.role === 'admin'
                  return (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.4) }}
                      className={`group border-b border-sand/60 transition-colors last:border-0 hover:bg-clay-50/40 ${
                        u.is_active ? '' : 'opacity-60'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-bark-700">{u.username}</p>
                      </td>
                      <td className="px-5 py-3.5 text-bark-500">{u.patient_number ?? '—'}</td>
                      <td className="px-5 py-3.5 text-bark-500">{roleLabel[u.role] ?? u.role}</td>
                      <td className="px-5 py-3.5">
                        <p className="text-bark-700">{u.name}</p>
                        {u.title && <p className="text-xs text-bark-300">{u.title}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-bark-500">{formatDate(u.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge
                          status={u.is_active ? 'ACTIVE' : 'DISABLED'}
                          label={u.is_active ? '啟用中' : '已停用'}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                          <ActionButton
                            label="編輯資料"
                            onClick={() => {
                              setEditTarget(u)
                              setEditForm({ name: u.name, title: u.title ?? '', phone: '' })
                            }}
                          >
                            <Pencil size={15} />
                          </ActionButton>
                          <ActionButton
                            label="重設密碼"
                            onClick={() => {
                              setResetTarget(u)
                              setResetValue('1234')
                            }}
                          >
                            <KeyRound size={15} />
                          </ActionButton>
                          {!locked && (
                            <>
                              <ActionButton
                                label={u.is_active ? '停用帳號' : '重新啟用帳號'}
                                onClick={() => handleToggleActive(u)}
                              >
                                {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                              </ActionButton>
                              <ActionButton
                                label={
                                  u.has_related_data ? '停用帳號（有關聯資料，無法刪除）' : '刪除帳號'
                                }
                                danger
                                onClick={() => setDeleteTarget(u)}
                              >
                                <Trash2 size={15} />
                              </ActionButton>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新增帳號 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增帳號</DialogTitle>
            <DialogDescription>密碼留空時預設為 1234</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="label">帳號 *</label>
                <input
                  className="input"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">密碼</label>
                <input
                  className="input"
                  placeholder="1234"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="label">角色 *</label>
                <select
                  className="input"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      role: e.target.value as 'doctor' | 'nurse' | 'patient',
                    })
                  }
                >
                  <option value="doctor">醫師</option>
                  <option value="nurse">護理師</option>
                  <option value="patient">病患</option>
                </select>
              </div>
              <div>
                <label className="label">姓名 *</label>
                <input
                  className="input"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>
            </div>
            {createForm.role !== 'patient' && (
              <div>
                <label className="label">職稱</label>
                <input
                  className="input"
                  placeholder="如：復健科主治醫師"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                />
              </div>
            )}
            {createForm.role === 'patient' && (
              <div className="space-y-3.5 rounded-xl bg-parchment/60 p-4">
                <p className="text-xs font-medium text-bark-400">病患基本資料</p>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">病歷號 *</label>
                    <input
                      className="input"
                      placeholder="P000021"
                      value={createForm.patient_number}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, patient_number: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="label">生日 *</label>
                    <input
                      className="input"
                      type="date"
                      value={createForm.birth_date}
                      onChange={(e) => setCreateForm({ ...createForm, birth_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="label">性別 *</label>
                    <select
                      className="input"
                      value={createForm.gender}
                      onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}
                    >
                      <option value="MALE">男</option>
                      <option value="FEMALE">女</option>
                      <option value="OTHER">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">電話</label>
                    <input
                      className="input"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? '建立中…' : '建立帳號'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 編輯資料 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯帳號資料</DialogTitle>
            <DialogDescription>
              {editTarget?.username}（{editTarget ? roleLabel[editTarget.role] : ''}）· 角色不可變更
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3.5">
            <div>
              <label className="label">姓名</label>
              <input
                className="input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            {editTarget?.role !== 'patient' && (
              <div>
                <label className="label">職稱</label>
                <input
                  className="input"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
            )}
            {editTarget?.role === 'patient' && (
              <div>
                <label className="label">電話（留空不變更）</label>
                <input
                  className="input"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            )}
            <DialogFooter>
              <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? '儲存中…' : '儲存'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 重設密碼 */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重設密碼</DialogTitle>
            <DialogDescription>為 {resetTarget?.username} 設定新密碼</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReset} className="space-y-3.5">
            <div>
              <label className="label">新密碼</label>
              <input
                className="input"
                value={resetValue}
                onChange={(e) => setResetValue(e.target.value)}
                placeholder="1234"
              />
            </div>
            <DialogFooter>
              <button type="button" className="btn-secondary" onClick={() => setResetTarget(null)}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? '重設中…' : '重設密碼'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除 / 停用確認 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.has_related_data ? '停用帳號' : '刪除帳號'}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.has_related_data
                ? `${deleteTarget?.username}（${deleteTarget?.name}）已有看診、計畫或影片等關聯資料，無法直接刪除，將改為停用（無法登入，資料保留）。`
                : `確定要永久刪除 ${deleteTarget?.username}（${deleteTarget?.name}）嗎？此操作無法復原。`}
            </DialogDescription>
          </DialogHeader>
          {deleteTarget?.role === 'patient' && deleteTarget?.patient_number && (
            <p className="text-xs text-bark-400">病歷號 {deleteTarget.patient_number}</p>
          )}
          <DialogFooter>
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
              取消
            </button>
            <button
              className="btn-primary bg-rust hover:bg-rust/90"
              disabled={submitting}
              onClick={handleDelete}
            >
              {submitting
                ? '處理中…'
                : deleteTarget?.has_related_data
                  ? '確認停用'
                  : '確認刪除'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
    </TooltipProvider>
  )
}
