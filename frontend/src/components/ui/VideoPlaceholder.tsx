import { motion } from 'framer-motion'
import { Clapperboard, Play } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  /** 已有影片 URL（僅佔位顯示檔名）；null 代表尚未上傳 */
  videoUrl?: string | null
  aspect?: 'video' | 'square'
  className?: string
}

/** 影片佔位卡：播放器區域先以佔位呈現，實際影片功能即將推出 */
export function VideoPlaceholder({ title, subtitle, videoUrl, aspect = 'video', className }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-sand bg-gradient-to-br from-[#3D3229] to-[#544838] ${
        aspect === 'video' ? 'aspect-video' : 'aspect-square'
      } ${className ?? ''}`}
    >
      {/* 裝飾網格 */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <motion.div
          whileHover={{ scale: 1.08 }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm"
        >
          <Play size={22} className="ml-0.5 text-white/90" fill="rgba(255,255,255,0.9)" />
        </motion.div>
        <div>
          <p className="text-sm font-medium text-white/90">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>}
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/60">
          <Clapperboard size={12} />
          {videoUrl ? '影片播放功能即將推出' : '尚未上傳影片'}
        </span>
      </div>
    </div>
  )
}
