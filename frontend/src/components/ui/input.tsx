import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full rounded-xl border border-sand bg-white px-4 py-2.5 text-sm text-bark-700 transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-bark-300 focus:outline-none focus:border-clay-400 focus:shadow-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
