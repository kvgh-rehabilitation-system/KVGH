import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bookmark,
  Eye,
  EyeOff,
  Folder,
  FolderInput,
  Pencil,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react'
import { teacherVideoUrl } from '../../../../api/media'
import { Button } from '../../../../components/ui/button'
import { VideoPlayer } from '../../../../components/ui/VideoPlayer'
import type { TeacherVideo } from '../../../../types'
import { formatDate } from '../../../../utils/format'
import { ExtractionPill } from './ExtractionPill'

interface Props {
  video: TeacherVideo
  folderName: string | null
  onRename: (tv: TeacherVideo) => void
  onMove: (tv: TeacherVideo) => void
  onReextract: (tv: TeacherVideo) => void
  onDelete: (tv: TeacherVideo) => void
}

/** 影片庫的單支影片卡：預覽、標註入口、改名/移動/重新萃取/刪除 */
export function LibraryVideoCard({
  video,
  folderName,
  onRename,
  onMove,
  onReextract,
  onDelete,
}: Props) {
  const [previewing, setPreviewing] = useState(false)
  const extracted = video.extraction_status === 'EXTRACTED'
  const canReextract = extracted || video.extraction_status === 'FAILED'

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="card flex flex-col gap-3 p-4"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-bark-700">
            {video.name ?? video.original_filename ?? `影片 #${video.id}`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-bark-300">
            <span className="inline-flex items-center gap-1">
              <User size={11} /> {video.uploader_name ?? '—'}
            </span>
            <span>{formatDate(video.created_at)}</span>
            <span className="inline-flex items-center gap-1">
              <Folder size={11} /> {folderName ?? '未分類'}
            </span>
          </p>
        </div>
        <ExtractionPill video={video} />
      </div>

      {video.extraction_status === 'FAILED' && video.extraction_error && (
        <p className="rounded-lg bg-[#FBF5F3] px-3 py-2 text-[11px] leading-relaxed text-rust">
          {video.extraction_error}
        </p>
      )}

      <AnimatePresence>
        {previewing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="h-[240px]">
              <VideoPlayer
                src={teacherVideoUrl(video.id)}
                title={video.name ?? undefined}
                aspect="fill-height"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-sand/70 pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={!extracted}
          onClick={() => setPreviewing((p) => !p)}
        >
          {previewing ? <EyeOff size={13} /> : <Eye size={13} />}
          {previewing ? '收合' : '預覽'}
        </Button>
        {extracted ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/nurse/teacher-videos/${video.id}/annotate`}>
              <Bookmark size={13} />
              {video.annotation_status === 'ANNOTATED' ? '調整標註' : '標註'}
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            <Bookmark size={13} /> 標註
          </Button>
        )}

        <span className="flex-1" />

        <Button variant="ghost" size="sm" title="重新命名" onClick={() => onRename(video)}>
          <Pencil size={13} />
        </Button>
        <Button variant="ghost" size="sm" title="移動資料夾" onClick={() => onMove(video)}>
          <FolderInput size={13} />
        </Button>
        {canReextract && (
          <Button
            variant="ghost"
            size="sm"
            title="重新執行演算法"
            onClick={() => onReextract(video)}
          >
            <RefreshCw size={13} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          title="刪除"
          className="text-rust hover:bg-[#FBF5F3] hover:text-rust"
          onClick={() => onDelete(video)}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </motion.li>
  )
}
