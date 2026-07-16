// shadcn/ui 標準元件（cva 變體徽章）；狀態色徽章請用自製的 StatusBadge
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-clay-100 text-clay-700',
        sage: 'bg-sage-100 text-sage-700',
        amber: 'bg-[#F7EDD8] text-[#96700F]',
        rust: 'bg-[#F7E8E4] text-rust',
        muted: 'bg-parchment text-bark-500',
        outline: 'border border-sand text-bark-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
