import { motion } from 'framer-motion'

interface Props {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
  layoutId?: string
}

/** 頁籤：底線以 layoutId 平滑滑動 */
export function Tabs({ tabs, active, onChange, layoutId = 'tab-underline' }: Props) {
  return (
    <div className="flex gap-1 border-b border-sand">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
            active === tab.key ? 'text-clay-600' : 'text-bark-400 hover:text-bark-600'
          }`}
        >
          {tab.label}
          {active === tab.key && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-clay-500"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
