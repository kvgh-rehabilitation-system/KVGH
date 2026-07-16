import { Cpu } from 'lucide-react'
import { LazyHumanMotionReplay, LazyHumanReplay } from '../../../../components/three/lazy'
import { Skeleton } from '../../../../components/ui/skeleton'
import type { Analysis } from '../../../../types'
import type { NpyArray } from '../../../../utils/npy'

interface Props {
  analysis: Analysis
  /** 病患 3D 骨架；undefined = 載入中，null = 無資料（seed）退回示意動畫 */
  pose: NpyArray | null | undefined
}

/**
 * 3D 動作重播面板，依 pose 載入結果三態切換：
 * - undefined（.npy 下載中）→ 骨架 Skeleton 占位
 * - NpyArray（MotionBERT 3D 骨架，(幀, 17, 3) H36M 17 關節）→ HumanReplay 素體重定向重播
 * - null（磁碟無檔案，如 seed 假資料 404）→ HumanMotionReplay 關節角度示意動畫
 *
 * three.js 元件一律走 lazy 版本載入，讓 three 獨立 chunk 不拖慢一般頁面。
 */
export function MotionReplayPanel({ analysis, pose }: Props) {
  // 撈出偏差達 HIGH 的關節名，重播時把對應部位標紅
  const highJoints = analysis.metrics.joint_deviations
    .filter((d) => d.status === 'HIGH')
    .map((d) => d.joint)

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-bark-700">
          <Cpu size={17} className="text-clay-500" /> 3D 動作重播
        </h2>
        <span className="text-xs text-bark-300">
          {pose
            ? '由演算法 3D 關節點重建，可 360° 拖曳觀察，紅色為偏差關節'
            : '由關節角度序列重建的示意動畫，紅點為偏差關節'}
        </span>
      </div>
      {pose === undefined ? (
        <Skeleton className="h-[380px] w-full rounded-2xl" />
      ) : pose ? (
        <LazyHumanReplay
          pose={pose}
          // .npy 本身不帶 fps，取分析結果的 motion_sequence.fps；缺值時以 30 播放
          fps={analysis.metrics.motion_sequence?.fps || 30}
          highJoints={highJoints}
          className="h-[380px]"
        />
      ) : (
        <LazyHumanMotionReplay
          sequence={analysis.metrics.motion_sequence}
          deviations={analysis.metrics.joint_deviations}
          className="h-[380px]"
        />
      )}
    </section>
  )
}
