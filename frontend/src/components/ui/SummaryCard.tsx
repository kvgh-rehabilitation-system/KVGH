import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { AnimatedNumber } from './AnimatedNumber'
import { staggerItem } from './motionVariants'

interface Props {
  label: string
  value: number
  icon: LucideIcon
  tone?: 'clay' | 'sage' | 'amber' | 'rust' | 'bark'
  hint?: string
}

const tones = {
  clay: 'bg-clay-50 text-clay-600',
  sage: 'bg-sage-50 text-sage-600',
  amber: 'bg-[#FBF3E2] text-[#A87A24]',
  rust: 'bg-[#F7E8E4] text-rust',
  bark: 'bg-parchment text-bark-500',
}

/** Dashboard 統計卡片：stagger 進場 + 數字滾動 + hover 微上浮 */
export function SummaryCard({ label, value, icon: Icon, tone = 'clay', hint }: Props) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="card card-hover p-5 flex items-start gap-4"
    >
      <div className={`rounded-xl p-3 ${tones[tone]}`}>
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-bark-400">{label}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-bark-700">
          <AnimatedNumber value={value} />
        </p>
        {hint && <p className="mt-0.5 text-xs text-bark-300">{hint}</p>}
      </div>
    </motion.div>
  )
}
