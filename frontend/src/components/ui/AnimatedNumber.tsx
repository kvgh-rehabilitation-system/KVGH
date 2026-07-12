import { useEffect, useRef } from 'react'
import { animate, useInView, useMotionValue } from 'framer-motion'

/** 數字滾動動畫 */
export function AnimatedNumber({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(0)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = String(Math.round(latest))
      },
    })
    return () => controls.stop()
  }, [inView, value, duration, motionValue])

  return <span ref={ref}>0</span>
}
