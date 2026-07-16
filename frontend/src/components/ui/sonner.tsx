// shadcn/ui 標準元件（sonner toast 容器），僅樣式客製；App.tsx 掛一次全站可用
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-bark-700 group-[.toaster]:border-sand group-[.toaster]:shadow-lifted group-[.toaster]:rounded-2xl',
          description: 'group-[.toast]:text-bark-400',
          actionButton: 'group-[.toast]:bg-clay-500 group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-parchment group-[.toast]:text-bark-500',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
