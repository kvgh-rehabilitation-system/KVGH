import { Link } from 'react-router-dom'
import {
  Bookmark,
  CalendarDays,
  Folder,
  FolderInput,
  Pencil,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react'
import { teacherVideoUrl } from '../../../../api/media'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'
import { VideoPlayer } from '../../../../components/ui/VideoPlayer'
import type { TeacherVideo } from '../../../../types'
import { formatDate, withRole } from '../../../../utils/format'
import { ExtractionPill } from './ExtractionPill'

interface Props {
  video: TeacherVideo | null
  folderName: string | null
  onOpenChange: (open: boolean) => void
  onRename: (tv: TeacherVideo) => void
  onMove: (tv: TeacherVideo) => void
  onReextract: (tv: TeacherVideo) => void
  onDelete: (tv: TeacherVideo) => void
}

export function PreviewVideoDialog({
  video,
  folderName,
  onOpenChange,
  onRename,
  onMove,
  onReextract,
  onDelete,
}: Props) {
  if (!video) return null

  const extracted = video.extraction_status === 'EXTRACTED'
  const canReextract = extracted || video.extraction_status === 'FAILED'
  const title = video.name ?? video.original_filename ?? `影片 #${video.id}`

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[90dvh] max-h-[52rem] w-[90vw] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-cream p-0">
        <DialogHeader className="border-b border-sand/80 bg-white px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-16">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate pr-1">{title}</DialogTitle>
              <DialogDescription className="sr-only">
                預覽導師示範影片並使用影片管理快捷鍵
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-bark-300">
                <span className="inline-flex items-center gap-1.5">
                  <User size={13} /> {video.uploader_name ? withRole(video.uploader_name, 'nurse') : '—'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={13} /> {formatDate(video.created_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Folder size={13} /> {folderName ?? '未分類'}
                </span>
              </div>
            </div>
            <ExtractionPill video={video} />
          </div>
        </DialogHeader>

        <div className="flex min-h-0 items-center justify-center bg-bark-800 p-2 sm:p-4">
          <VideoPlayer
            src={teacherVideoUrl(video.id)}
            title={title}
            aspect="auto"
            className="flex h-full w-full items-center justify-center rounded-xl border-white/10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-sand/80 bg-white px-4 py-3 sm:px-6 sm:py-4">
          {extracted ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/nurse/teacher-videos/${video.id}/annotate`}>
                <Bookmark size={14} />
                {video.annotation_status === 'ANNOTATED' ? '調整標註' : '標註'}
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" disabled>
              <Bookmark size={14} /> 標註
            </Button>
          )}

          <span className="hidden flex-1 sm:block" />

          <Button variant="ghost" size="sm" onClick={() => onRename(video)}>
            <Pencil size={14} /> 重新命名
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onMove(video)}>
            <FolderInput size={14} /> 移動
          </Button>
          {canReextract && (
            <Button variant="ghost" size="sm" onClick={() => onReextract(video)}>
              <RefreshCw size={14} /> 重新萃取
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-rust hover:bg-[#FBF5F3] hover:text-rust"
            onClick={() => onDelete(video)}
          >
            <Trash2 size={14} /> 刪除
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
