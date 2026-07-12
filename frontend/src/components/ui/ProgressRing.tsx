import { motion } from 'framer-motion'

interface Props {
  progress: number // 0~1
  size?: number
  strokeWidth?: number
  label?: string
}

/** 圓形進度環：draw-in 動畫 */
export function ProgressRing({ progress, size = 120, strokeWidth = 10, label }: Props) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EAE3D8"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#8A9B6E"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold text-bark-700">{Math.round(clamped * 100)}%</span>
        {label && <span className="text-[11px] text-bark-400">{label}</span>}
      </div>
    </div>
  )
}
