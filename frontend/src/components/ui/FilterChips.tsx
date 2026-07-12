import { motion } from 'framer-motion'

interface Props {
  options: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
  layoutId: string
}

/** 篩選 chips：選中背景以 layoutId 平滑移動 */
export function FilterChips({ options, active, onChange, layoutId }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            active === opt.key ? 'text-white' : 'text-bark-500 hover:text-clay-600'
          }`}
        >
          {active === opt.key && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-full bg-clay-500"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
