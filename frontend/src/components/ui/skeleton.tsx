// shadcn/ui 標準元件（載入骨架屏），僅樣式客製
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} {...props} />
}

export { Skeleton }
