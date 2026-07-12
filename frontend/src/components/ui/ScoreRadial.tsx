import { motion } from 'framer-motion'
import { AnimatedNumber } from './AnimatedNumber'
import { scoreColor, scoreGrade } from '../../utils/format'

interface RingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  delay?: number
}

/** 單一分數環：count-up + 環形 draw-in */
export function ScoreRing({ score, size = 132, strokeWidth = 11, label, delay = 0 }: RingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score)) / 100
  const color = scoreColor(score)

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
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
          <AnimatedNumber value={Math.round(score)} />
        </span>
        <span className="text-[11px] text-bark-400">{label ?? scoreGrade(score)}</span>
      </div>
    </div>
  )
}

interface RadialProps {
  overall: number
  jointAngle: number
  stability: number
  posture: number
}

/** 演算法分數面板：一大環（整體）+ 三小環（關節角度 / 穩定度 / 姿勢） */
export function ScoreRadial({ overall, jointAngle, stability, posture }: RadialProps) {
  const subs = [
    { label: '關節角度', value: jointAngle },
    { label: '穩定度', value: stability },
    { label: '姿勢', value: posture },
  ]
  return (
    <div className="flex flex-wrap items-center gap-6">
      <ScoreRing score={overall} label={`整體・${scoreGrade(overall)}`} size={148} />
      <div className="flex gap-4">
        {subs.map((s, i) => (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <ScoreRing score={s.value} size={84} strokeWidth={8} label="" delay={0.15 * (i + 1)} />
            <span className="text-xs text-bark-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
