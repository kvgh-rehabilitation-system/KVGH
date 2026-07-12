import { Pause, Play, RotateCcw } from 'lucide-react'

interface Props {
  playing: boolean
  speed: number
  duration: number
  onTogglePlay: () => void
  onRestart: () => void
  onSpeedChange: (speed: number) => void
}

/** 3D 重播共用控制列：播放/暫停、重播、0.5/1/2x 倍速 */
export function ReplayControls({
  playing,
  speed,
  duration,
  onTogglePlay,
  onRestart,
  onSpeedChange,
}: Props) {
  return (
    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-bark-800/70 px-2.5 py-1.5 backdrop-blur-sm">
      <button
        onClick={onTogglePlay}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
        title={playing ? '暫停' : '播放'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <button
        onClick={onRestart}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/15"
        title="重播"
      >
        <RotateCcw size={13} />
      </button>
      <div className="mx-1 h-4 w-px bg-white/20" />
      {[0.5, 1, 2].map((s) => (
        <button
          key={s}
          onClick={() => onSpeedChange(s)}
          className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
            speed === s ? 'bg-clay-500 text-white' : 'text-white/60 hover:bg-white/15'
          }`}
        >
          {s}x
        </button>
      ))}
      <span className="ml-1 text-[11px] tabular-nums text-white/50">{duration.toFixed(0)}s</span>
    </div>
  )
}
