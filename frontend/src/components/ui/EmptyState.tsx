import { motion } from 'framer-motion'
import { Leaf } from 'lucide-react'

/** 空清單佔位（葉子 icon + 訊息），列表查無資料時共用。 */
export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="rounded-full bg-sage-50 p-4 text-sage-400">
        <Leaf size={28} strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm font-medium text-bark-500">{message}</p>
      {hint && <p className="mt-1 text-xs text-bark-300">{hint}</p>}
    </motion.div>
  )
}
