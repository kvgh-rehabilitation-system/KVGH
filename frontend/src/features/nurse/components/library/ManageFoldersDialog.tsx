import { useState } from 'react'
import { Check, FolderPlus, Pencil, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../../api/client'
import {
  createTeacherVideoFolder,
  deleteTeacherVideoFolder,
  renameTeacherVideoFolder,
} from '../../../../api/nurse'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { Input } from '../../../../components/ui/input'
import type { TeacherVideoFolder } from '../../../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: TeacherVideoFolder[]
  /** 任一異動後重抓資料夾與影片清單 */
  onChanged: () => void
}

/** 資料夾管理：新增、改名、刪除（刪除後夾內影片移至未分類） */
export function ManageFoldersDialog({ open, onOpenChange, folders, onChanged }: Props) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    const clean = newName.trim()
    if (!clean) {
      toast.error('請輸入資料夾名稱')
      return
    }
    setCreating(true)
    try {
      await createTeacherVideoFolder(clean)
      setNewName('')
      toast.success('資料夾已建立')
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const rename = async (folder: TeacherVideoFolder) => {
    const clean = editName.trim()
    if (!clean) {
      toast.error('請輸入資料夾名稱')
      return
    }
    if (clean === folder.name) {
      setEditingId(null)
      return
    }
    setBusy(true)
    try {
      await renameTeacherVideoFolder(folder.id, clean)
      setEditingId(null)
      toast.success('資料夾已改名')
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (folder: TeacherVideoFolder) => {
    setBusy(true)
    try {
      await deleteTeacherVideoFolder(folder.id)
      setPendingDeleteId(null)
      toast.success('資料夾已刪除，影片已移至未分類')
      onChanged()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>管理資料夾</DialogTitle>
          <DialogDescription>
            資料夾為全院共享的影片分類；刪除資料夾時，夾內影片會移至「未分類」。
          </DialogDescription>
        </DialogHeader>

        {/* 新增資料夾 */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="新資料夾名稱，例如：下肢訓練"
            className="flex-1"
          />
          <Button variant="secondary" disabled={creating} onClick={create}>
            <FolderPlus size={14} /> 新增
          </Button>
        </div>

        {/* 資料夾清單 */}
        <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          {folders.length === 0 ? (
            <p className="py-4 text-center text-xs text-bark-300">
              還沒有資料夾，建立第一個分類吧
            </p>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-xl border border-sand bg-white px-3.5 py-2.5"
              >
                {editingId === f.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && rename(f)}
                      className="h-8 flex-1 py-1"
                      autoFocus
                    />
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => rename(f)}>
                      <Check size={13} /> 儲存
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      <X size={13} />
                    </Button>
                  </>
                ) : pendingDeleteId === f.id ? (
                  <>
                    <p className="min-w-0 flex-1 truncate text-sm text-bark-600">
                      刪除「{f.name}」？夾內 {f.video_count} 支影片將移至未分類
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => remove(f)}
                    >
                      確認刪除
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="min-w-0 flex-1 truncate text-sm text-bark-700">
                      {f.name}
                      <span className="ml-2 text-[11px] text-bark-300">
                        {f.video_count} 支影片
                      </span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(f.id)
                        setEditName(f.name)
                        setPendingDeleteId(null)
                      }}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rust hover:bg-[#FBF5F3] hover:text-rust"
                      onClick={() => {
                        setPendingDeleteId(f.id)
                        setEditingId(null)
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
