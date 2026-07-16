// shadcn/ui 標準元件（Radix Slot + cva 變體樣式），僅按本專案暖色調調整，邏輯未動
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:shadow-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-clay-500 text-white shadow-soft hover:bg-clay-600 hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'bg-white text-bark-600 border border-sand shadow-soft hover:border-clay-300 hover:text-clay-600 hover:-translate-y-0.5 active:translate-y-0',
        sage: 'bg-sage-500 text-white shadow-soft hover:bg-sage-600 hover:-translate-y-0.5 active:translate-y-0',
        ghost: 'text-clay-600 hover:bg-clay-50',
        outline:
          'border border-sand bg-transparent text-bark-600 hover:bg-clay-50 hover:text-clay-600',
        destructive: 'bg-rust text-white shadow-soft hover:bg-rust/90',
        link: 'text-clay-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-4 py-2.5',
        sm: 'rounded-lg px-3 py-1.5 text-xs',
        lg: 'rounded-xl px-6 py-3 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
