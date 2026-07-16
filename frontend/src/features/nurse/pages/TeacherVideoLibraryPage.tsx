import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { FolderCog, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../api/client'
import {
  deleteTeacherVideo,
  listTeacherVideoFolders,
  listTeacherVideos,
  reextractTeacherVideo,
  updateTeacherVideo,
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
import { FilterChips } from '../../../components/ui/FilterChips'
import { Input } from '../../../components/ui/input'
import { Loading } from '../../../components/ui/Loading'
import { PageHeader } from '../../../components/ui/PageHeader'
import { PageTransition } from '../../../components/ui/PageTransition'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import type { TeacherVideo, TeacherVideoFolder } from '../../../types'
import { ConfirmDialog } from '../components/library/ConfirmDialog'
import { PROCESSING_STATUSES } from '../components/library/ExtractionPill'
import { LibraryVideoCard } from '../components/library/LibraryVideoCard'
import { ManageFoldersDialog } from '../components/library/ManageFoldersDialog'
import { PreviewVideoDialog } from '../components/library/PreviewVideoDialog'
import { UploadDialog } from '../components/library/UploadDialog'

const ALL = 'ALL'
const UNFILED = 'UNFILED'

/**
 * 導師影片庫管理頁：上傳、改名、資料夾分類、重新萃取、刪除、標註入口。
 * 影片庫跨護理師共享；選片綁定動作仍走計畫動作頁的 TeacherVideoPickerDialog。
 */
export function TeacherVideoLibraryPage() {
  const [videos, setVideos] = useState<TeacherVideo[] | null>(null)
  const [folders, setFolders] = useState<TeacherVideoFolder[]>([])
  const [activeFolder, setActiveFolder] = useState(ALL)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<TeacherVideo | null>(null)
  const [renameTarget, setRenameTarget] = useState<TeacherVideo | null>(null)
  const [moveTarget, setMoveTarget] = useState<TeacherVideo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TeacherVideo | null>(null)
  const [reextractTarget, setReextractTarget] = useState<TeacherVideo | null>(null)

  const refresh = useCallback(() => {
    Promise.all([listTeacherVideos(), listTeacherVideoFolders()])
      .then(([v, f]) => {
        setVideos(v)
        setFolders(f)
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 有影片處理中時每 3 秒更新狀態
  const hasProcessing = videos?.some((v) => PROCESSING_STATUSES.includes(v.extraction_status))
  useEffect(() => {
    if (!hasProcessing) return
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [hasProcessing, refresh])

  // 選中的資料夾被刪除時退回「全部」
  useEffect(() => {
    if (activeFolder === ALL || activeFolder === UNFILED) return
    if (!folders.some((f) => String(f.id) === activeFolder)) setActiveFolder(ALL)
  }, [folders, activeFolder])

  const folderNameById = useMemo(
    () => new Map(folders.map((f) => [f.id, f.name])),
    [folders],
  )

  const chips = useMemo(() => {
    const list = videos ?? []
    const unfiled = list.filter((v) => v.folder_id == null).length
    return [
      { key: ALL, label: `全部（${list.length}）` },
      { key: UNFILED, label: `未分類（${unfiled}）` },
      ...folders.map((f) => ({
        key: String(f.id),
        label: `${f.name}（${list.filter((v) => v.folder_id === f.id).length}）`,
      })),
    ]
  }, [videos, folders])

  const filtered = useMemo(() => {
    if (!videos) return []
    if (activeFolder === ALL) return videos
    if (activeFolder === UNFILED) return videos.filter((v) => v.folder_id == null)
    return videos.filter((v) => String(v.folder_id) === activeFolder)
  }, [videos, activeFolder])

  /**
   * 刪除導師影片（影片檔與萃取產物一併移除；被計畫動作引用時後端會擋）。
   * 失敗時重拋錯誤讓 ConfirmDialog 保持開啟，使用者可看到錯誤後再取消。
   */
  const removeVideo = async () => {
    if (!deleteTarget) return
    try {
      await deleteTeacherVideo(deleteTarget.id)
      toast.success('導師影片已刪除')
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
      throw err
    }
  }

  /** 重新排入 2D/3D 萃取（背景任務）；失敗時重拋讓 ConfirmDialog 保持開啟。 */
  const reextract = async () => {
    if (!reextractTarget) return
    try {
      await reextractTeacherVideo(reextractTarget.id)
      toast.info('已重新排入 2D/3D 萃取，背景處理中…')
      refresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
      throw err
    }
  }

  return (
    <PageTransition>
      <PageHeader
        title="導師影片庫"
        subtitle="全院共享的示範影片：上傳、分類、標註與重新萃取"
        actions={
          <>
            <Button variant="secondary" onClick={() => setManageOpen(true)}>
              <FolderCog size={15} /> 管理資料夾
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload size={15} /> 上傳影片
            </Button>
          </>
        }
      />

      {/* 資料夾篩選 */}
      <div className="card mb-5 p-4">
        <FilterChips
          options={chips}
          active={activeFolder}
          onChange={setActiveFolder}
          layoutId="tv-library-folder"
        />
      </div>

      {!videos ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            message={activeFolder === ALL ? '影片庫還是空的' : '這個資料夾沒有影片'}
            hint={
              activeFolder === ALL
                ? '上傳第一支導師示範影片吧'
                : '可用影片卡上的「移動資料夾」把影片歸類到這裡'
            }
          />
        </div>
      ) : (
        <ul className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {filtered.map((v) => (
              <LibraryVideoCard
                key={v.id}
                video={v}
                folderName={v.folder_id != null ? (folderNameById.get(v.folder_id) ?? null) : null}
                onPreview={setPreviewTarget}
                onRename={setRenameTarget}
                onMove={setMoveTarget}
                onReextract={setReextractTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folders={folders}
        defaultFolderId={
          activeFolder !== ALL && activeFolder !== UNFILED ? Number(activeFolder) : null
        }
        onUploaded={refresh}
      />

      <ManageFoldersDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        folders={folders}
        onChanged={refresh}
      />

      <PreviewVideoDialog
        video={previewTarget}
        folderName={
          previewTarget?.folder_id != null
            ? (folderNameById.get(previewTarget.folder_id) ?? null)
            : null
        }
        onOpenChange={(open) => !open && setPreviewTarget(null)}
        onRename={(video) => {
          setPreviewTarget(null)
          setRenameTarget(video)
        }}
        onMove={(video) => {
          setPreviewTarget(null)
          setMoveTarget(video)
        }}
        onReextract={(video) => {
          setPreviewTarget(null)
          setReextractTarget(video)
        }}
        onDelete={(video) => {
          setPreviewTarget(null)
          setDeleteTarget(video)
        }}
      />

      {renameTarget && (
        <RenameVideoDialog
          video={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={refresh}
        />
      )}

      {moveTarget && (
        <MoveFolderDialog
          video={moveTarget}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="刪除導師影片"
        description={`確定刪除「${
          deleteTarget?.name ?? deleteTarget?.original_filename ?? `影片 #${deleteTarget?.id}`
        }」？影片檔與萃取產物將一併移除，仍被復健計畫動作引用的影片無法刪除。`}
        confirmLabel="刪除"
        destructive
        onConfirm={removeVideo}
      />

      <ConfirmDialog
        open={reextractTarget != null}
        onOpenChange={(o) => !o && setReextractTarget(null)}
        title="重新執行演算法"
        description={`將對「${
          reextractTarget?.name ?? `影片 #${reextractTarget?.id}`
        }」重新執行 2D/3D 姿態萃取（背景處理），已標註的重點動作會保留；既有病患分析結果不受影響。`}
        confirmLabel="重新萃取"
        onConfirm={reextract}
      />
    </PageTransition>
  )
}

// ---- 小型彈窗（僅本頁使用） ----

/** 重新命名影片的小彈窗：名稱顯示於影片庫與選片清單，Enter 可直接送出。 */
function RenameVideoDialog({
  video,
  onClose,
  onSaved,
}: {
  video: TeacherVideo
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(video.name ?? video.original_filename ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const clean = name.trim()
    if (!clean) {
      toast.error('請輸入影片名稱')
      return
    }
    setSaving(true)
    try {
      await updateTeacherVideo(video.id, { name: clean })
      toast.success('影片已重新命名')
      onClose()
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>重新命名影片</DialogTitle>
          <DialogDescription>名稱會顯示在影片庫與計畫動作的選片清單。</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="影片名稱"
          autoFocus
        />
        <DialogFooter>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            取消
          </Button>
          <Button disabled={saving} onClick={save}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 移動影片到資料夾的小彈窗；Radix Select 的 value 只吃字串，故以 'none' 哨兵值代表未分類。 */
function MoveFolderDialog({
  video,
  folders,
  onClose,
  onSaved,
}: {
  video: TeacherVideo
  folders: TeacherVideoFolder[]
  onClose: () => void
  onSaved: () => void
}) {
  const NONE = 'none'
  const [folderId, setFolderId] = useState<string>(
    video.folder_id != null ? String(video.folder_id) : NONE,
  )
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateTeacherVideo(video.id, {
        folder_id: folderId === NONE ? null : Number(folderId),
      })
      toast.success('影片已移動')
      onClose()
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>移動至資料夾</DialogTitle>
          <DialogDescription>
            「{video.name ?? video.original_filename ?? `影片 #${video.id}`}」要放進哪個資料夾？
          </DialogDescription>
        </DialogHeader>
        <Select value={folderId} onValueChange={setFolderId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>未分類</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            取消
          </Button>
          <Button disabled={saving} onClick={save}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            移動
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
