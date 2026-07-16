// shadcn/ui 標準元件（原生 textarea 包裝），僅樣式客製
import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[88px] w-full rounded-xl border border-sand bg-white px-4 py-2.5 text-sm text-bark-700 transition-all duration-200 placeholder:text-bark-300 focus:outline-none focus:border-clay-400 focus:shadow-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
