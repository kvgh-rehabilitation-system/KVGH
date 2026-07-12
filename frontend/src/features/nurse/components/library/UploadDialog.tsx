import { useRef, useState } from 'react'
import { FileVideo, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '../../../../api/client'
import { createTeacherVideo, updateTeacherVideo } from '../../../../api/nurse'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { Input } from '../../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select'
import type { TeacherVideoFolder } from '../../../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: TeacherVideoFolder[]
  /** 預設資料夾（目前選中的篩選資料夾） */
  defaultFolderId: number | null
  onUploaded: () => void
}

const NONE = 'none'

/** 上傳導師影片進影片庫（名稱必填，可直接歸入資料夾） */
export function UploadDialog({ open, onOpenChange, folders, defaultFolderId, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState<string>(
    defaultFolderId != null ? String(defaultFolderId) : NONE,
  )
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const reset = () => {
    setName('')
    setFile(null)
    setFolderId(defaultFolderId != null ? String(defaultFolderId) : NONE)
    if (fileRef.current) fileRef.current.value = ''
  }

  const submit = async () => {
    const clean = name.trim()
    if (!clean) {
      toast.error('請先輸入影片名稱，方便日後在影片庫辨識')
      return
    }
    if (!file) {
      toast.error('請選擇要上傳的影片檔案')
      return
    }
    setUploading(true)
    try {
      const tv = await createTeacherVideo(clean, file)
      if (folderId !== NONE) {
        await updateTeacherVideo(tv.id, { folder_id: Number(folderId) })
      }
      toast.info('影片已上傳進影片庫，背景轉檔與姿態萃取中…')
      reset()
      onOpenChange(false)
      onUploaded()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !uploading && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>上傳導師影片</DialogTitle>
          <DialogDescription>
            影片會進入跨醫護共享的影片庫，背景自動轉檔與 2D/3D 姿態萃取。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <p className="label mb-1.5">影片名稱（必填）</p>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：深蹲示範（正面）"
            />
          </div>
          <div>
            <p className="label mb-1.5">資料夾</p>
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
          </div>
          <div>
            <p className="label mb-1.5">影片檔案</p>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-sand bg-parchment/40 px-4 py-3 text-sm text-bark-500 transition-colors hover:border-clay-300 hover:text-clay-600"
            >
              <FileVideo size={16} className="shrink-0" />
              <span className="truncate">{file ? file.name : '點擊選擇影片檔案'}</span>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" disabled={uploading} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={uploading} onClick={submit}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? '上傳中…' : '上傳'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
