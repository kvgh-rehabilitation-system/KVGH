import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { staggerContainer, staggerItem } from './PageTransition'

export interface InfoGridItem {
  icon: LucideIcon
  label: string
  value: ReactNode
  /** 佔滿整列（columns=2 時） */
  span?: boolean
}

interface Props {
  items: InfoGridItem[]
  columns?: 1 | 2
}

/** 資訊格：icon 泡泡 + 標籤/數值 的網格排版，用於基本資料等唯讀欄位 */
export function InfoGrid({ items, columns = 2 }: Props) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={`grid gap-3 ${columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}
    >
      {items.map((item) => (
        <motion.div
          key={item.label}
          variants={staggerItem}
          className={`flex items-center gap-3 rounded-xl bg-parchment/50 px-3.5 py-3 ${
            item.span && columns === 2 ? 'sm:col-span-2' : ''
          }`}
        >
          <div className="shrink-0 rounded-lg bg-white p-2 text-clay-500 shadow-soft">
            <item.icon size={16} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-bark-300">{item.label}</p>
            <p className="truncate text-sm font-medium text-bark-600">{item.value}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
