import { motion } from 'framer-motion'

/** 頁面載入中的三點跳動指示（整頁資料抓取時共用）。 */
export function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-clay-400"
            animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  )
}
