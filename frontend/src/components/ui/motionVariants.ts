// 共用 framer-motion variants；與 PageTransition 元件分檔，讓元件檔維持 fast refresh
/** 子項逐一進場的容器 variants（搭配 staggerItem 用在卡片群）。 */
export const staggerContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07 },
  },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
}
