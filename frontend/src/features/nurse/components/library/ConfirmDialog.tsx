import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  /** 確認後執行；resolve 後自動關閉，reject 由呼叫端 toast */
  onConfirm: () => Promise<void>
}

/**
 * 破壞性/重要操作的通用確認彈窗（刪除影片、重新萃取等）。
 * 泛用元件：文案與動作全由 props 注入，本身只負責 busy 狀態與開關時機。
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false)

  /** 執行 onConfirm：成功關窗；失敗保持開啟讓使用者可重試（錯誤 toast 由呼叫端顯示） */
  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // 失敗訊息由呼叫端 toast，彈窗保持開啟
    } finally {
      setBusy(false)
    }
  }

  return (
    // 請求進行中鎖住關閉（點遮罩/Esc 都擋），避免操作結果不明時彈窗先消失
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={confirm}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
