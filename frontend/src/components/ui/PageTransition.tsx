import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** 頁面進場轉場：淡入 + 上移，供所有頁面共用；testId 供 e2e 驗證頁面已渲染 */
export function PageTransition({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <motion.div
      data-testid={testId}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
