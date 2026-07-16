import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bookmark,
  Eye,
  Folder,
  FolderInput,
  Pencil,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import type { TeacherVideo } from '../../../../types'
import { formatDate, withRole } from '../../../../utils/format'
import { ExtractionPill } from './ExtractionPill'

interface Props {
  video: TeacherVideo
  /** 所屬資料夾名稱；null 顯示「未分類」（由父頁面用 folder_id 反查後傳入） */
  folderName: string | null
  onPreview: (tv: TeacherVideo) => void
  onRename: (tv: TeacherVideo) => void
  onMove: (tv: TeacherVideo) => void
  onReextract: (tv: TeacherVideo) => void
  onDelete: (tv: TeacherVideo) => void
}

/**
 * 影片庫的單支影片卡：預覽、標註入口、改名/移動/重新萃取/刪除。
 * 純展示元件——所有操作都透過 callback 交回父頁面（對話框與 API 呼叫都在父層），
 * 卡片本身不持有任何請求狀態。
 */
export function LibraryVideoCard({
  video,
  folderName,
  onPreview,
  onRename,
  onMove,
  onReextract,
  onDelete,
}: Props) {
  // 預覽與標註都需要萃取完成；重新萃取只對「已完成」或「失敗」有意義
  // （處理中重跑會與進行中的任務打架，故不提供）
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
              <User size={11} /> {video.uploader_name ? withRole(video.uploader_name, 'nurse') : '—'}
            </span>
            <span>{formatDate(video.created_at)}</span>
            <span className="inline-flex items-center gap-1">
              <Folder size={11} /> {folderName ?? '未分類'}
            </span>
          </p>
        </div>
        <ExtractionPill video={video} />
      </div>

      {/* 萃取失敗時把 worker 回報的錯誤原文攤開，方便回報工程端排查 */}
      {video.extraction_status === 'FAILED' && video.extraction_error && (
        <p className="rounded-lg bg-[#FBF5F3] px-3 py-2 text-[11px] leading-relaxed text-rust">
          {video.extraction_error}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-sand/70 pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={!extracted}
          onClick={() => onPreview(video)}
        >
          <Eye size={13} />
          預覽
        </Button>
        {/* 標註是影片級屬性（影響所有引用此影片的動作）；未萃取完成前只給停用按鈕 */}
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
