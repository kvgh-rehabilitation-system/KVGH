interface Props {
  /** 串流 URL（api/media.ts 的 helper 產生，含 token） */
  src: string
  title?: string
  className?: string
  /** fill-height：高度撐滿父容器，寬度隨影片原生比例自動伸縮（父容器需有固定高度） */
  aspect?: 'video' | 'portrait' | 'auto' | 'fill-height'
  /** 需要外部控制（如跳轉秒數）時傳入 */
  videoRef?: React.Ref<HTMLVideoElement>
  onError?: () => void
}

/**
 * 影片播放器：HTTP Range + faststart mp4 → YouTube 式邊播邊緩衝，
 * 開頭即播、可拖曳跳轉，不必等整支下載。
 */
export function VideoPlayer({ src, title, className, aspect = 'video', videoRef, onError }: Props) {
  const aspectClass =
    aspect === 'video' ? 'aspect-video' : aspect === 'portrait' ? 'aspect-[9/16]' : ''

  if (aspect === 'fill-height') {
    return (
      <div
        className={`mx-auto h-full w-fit min-w-[200px] overflow-hidden rounded-2xl border border-sand bg-black ${className ?? ''}`}
      >
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          title={title}
          onError={onError}
          className="h-full w-auto object-contain"
        />
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-sand bg-black ${className ?? ''}`}>
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        preload="metadata"
        title={title}
        onError={onError}
        className={`h-full w-full ${aspectClass} object-contain`}
      />
    </div>
  )
}
