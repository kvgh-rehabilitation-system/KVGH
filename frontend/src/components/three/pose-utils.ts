/**
 * MotionBERT 3D 骨架（H36M 17 關節）的前端幾何工具。
 *
 * .npy 原始座標：root（骨盆）置中、數值約 [-1,1]、Y 軸向下為正。
 * 轉為 three.js（Y 向上、右手系）：x=-x_raw, y=-y_raw, z=z_raw
 * （與演算法 vismo.py 的繪圖轉換同構，保持左右手性一致）。
 */

import type { NpyArray } from '../../utils/npy'

export const H36M_JOINTS = 17

/** H36M 關節順序：0骨盆 1右髖 2右膝 3右踝 4左髖 5左膝 6左踝 7脊椎 8胸廓 9頸 10頭 11左肩 12左肘 13左腕 14右肩 15右肘 16右腕 */
export const H36M_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 4],
  [4, 5],
  [5, 6],
  [0, 7],
  [7, 8],
  [8, 9],
  [9, 10],
  [8, 11],
  [11, 12],
  [12, 13],
  [8, 14],
  [14, 15],
  [15, 16],
]

/** 每條骨段的膠囊半徑（與 H36M_EDGES 同序） */
export const EDGE_RADII = [
  0.055, // 骨盆→右髖
  0.055, // 右大腿
  0.045, // 右小腿
  0.055, // 骨盆→左髖
  0.055, // 左大腿
  0.045, // 左小腿
  0.07, // 下脊椎
  0.07, // 上脊椎
  0.035, // 頸
  0.03, // 頸→頭（大部分被頭部橢球蓋住）
  0.045, // 左鎖骨
  0.042, // 左上臂
  0.036, // 左前臂
  0.045, // 右鎖骨
  0.042, // 右上臂
  0.036, // 右前臂
]

/** 演算法儀表板 8 關節 → H36M 索引（偏差標紅用） */
export const H36M_JOINT_INDEX: Record<string, number> = {
  left_shoulder: 11,
  right_shoulder: 14,
  left_elbow: 12,
  right_elbow: 15,
  left_hip: 4,
  right_hip: 1,
  left_knee: 5,
  right_knee: 2,
}

/** 若素體左右與 motionbert 渲染影片鏡像不符，翻轉此開關 */
const MIRROR_Z = false

const TARGET_HEIGHT = 1.65 // 素體目標身高（公尺），配合既有攝影機構圖

export interface PreparedPose {
  frames: number
  /** frames×17×3，three.js 空間、已縮放、腳底貼地 */
  positions: Float32Array
  /** 每條骨段的中位長度（與 H36M_EDGES 同序），供膠囊幾何基準 */
  boneLengths: number[]
  height: number
}

export function preparePose(npy: NpyArray): PreparedPose {
  const [frames, joints, comps] = npy.shape
  if (joints !== H36M_JOINTS || comps !== 3) {
    throw new Error(`非預期的 3D 骨架 shape：${npy.shape.join('×')}`)
  }
  const raw = npy.data
  const out = new Float32Array(frames * H36M_JOINTS * 3)

  // 第一遍：座標轉換 + 收集每幀身高與踝高
  const frameHeights = new Float32Array(frames)
  const ankleLows = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    const base = f * H36M_JOINTS * 3
    let minY = Infinity
    let maxY = -Infinity
    for (let j = 0; j < H36M_JOINTS; j++) {
      const i = base + j * 3
      out[i] = -raw[i]
      out[i + 1] = -raw[i + 1]
      out[i + 2] = MIRROR_Z ? -raw[i + 2] : raw[i + 2]
      if (out[i + 1] < minY) minY = out[i + 1]
      if (out[i + 1] > maxY) maxY = out[i + 1]
    }
    frameHeights[f] = maxY - minY
    ankleLows[f] = Math.min(out[base + 3 * 3 + 1], out[base + 6 * 3 + 1])
  }

  const sortedHeights = Array.from(frameHeights).sort((a, b) => a - b)
  const medianHeight = sortedHeights[Math.floor(sortedHeights.length / 2)] || 1
  const scale = TARGET_HEIGHT / medianHeight

  // 地面取踝高第 5 百分位（避免單幀雜訊讓整體浮空）
  const sortedAnkles = Array.from(ankleLows).sort((a, b) => a - b)
  const ground = sortedAnkles[Math.floor(sortedAnkles.length * 0.05)] ?? 0

  // 第二遍：縮放 + 貼地
  for (let f = 0; f < frames; f++) {
    const base = f * H36M_JOINTS * 3
    for (let j = 0; j < H36M_JOINTS; j++) {
      const i = base + j * 3
      out[i] *= scale
      out[i + 1] = (out[i + 1] - ground) * scale
      out[i + 2] *= scale
    }
  }

  // 每條骨段的中位長度（取樣即可，MotionBERT 骨長近乎恆定）
  const stride = Math.max(1, Math.floor(frames / 200))
  const boneLengths = H36M_EDGES.map(([a, b]) => {
    const dists: number[] = []
    for (let f = 0; f < frames; f += stride) {
      const ia = f * H36M_JOINTS * 3 + a * 3
      const ib = f * H36M_JOINTS * 3 + b * 3
      dists.push(
        Math.hypot(out[ib] - out[ia], out[ib + 1] - out[ia + 1], out[ib + 2] - out[ia + 2]),
      )
    }
    dists.sort((x, y) => x - y)
    return dists[Math.floor(dists.length / 2)] || 0.1
  })

  return { frames, positions: out, boneLengths, height: TARGET_HEIGHT }
}
