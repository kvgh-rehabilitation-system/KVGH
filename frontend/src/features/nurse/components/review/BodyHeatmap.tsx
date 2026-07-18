import { motion } from 'framer-motion'
import type { JointDeviation } from '../../../../types'

/** 15° 為演算法的 HIGH 判定門檻，25° 以上顏色飽和 */
const THRESHOLD = 15
const SATURATE = 25

// 三段色錨點，對應 tailwind palette（sage / amber / rust），供漸層插值用
const GREEN = [138, 155, 110] // sage
const AMBER = [217, 164, 65]
const RED = [181, 84, 59] // rust

/**
 * 兩個 RGB 色之間線性插值。
 * @param t 插值比例 0（純 a）～1（純 b）
 * @returns CSS rgb() 字串
 */
function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/**
 * 偏差度數 → 連續熱區色（≤15° 綠→琥珀，>15° 琥珀→紅，≥25° 飽和純紅）。
 * 用兩段插值而非單段，讓門檻 15° 恰好落在琥珀色，視覺上與文案「明顯偏差」對齊。
 * 其他偏差視覺化元件要共用這套配色時，再連同色錨點一起拆到獨立模組。
 */
function heatColor(deg: number): string {
  if (deg <= THRESHOLD) return mix(GREEN, AMBER, Math.max(0, deg / THRESHOLD))
  return mix(AMBER, RED, Math.min(1, (deg - THRESHOLD) / (SATURATE - THRESHOLD)))
}

/**
 * 人形圖上的關節座標（viewBox 0 0 200 320，正面視角：病患面向你，
 * 所以畫面右側 = 病患左側）。anchor 決定文字標籤往內或往外對齊，
 * 讓左右兩側的標籤都朝人形外側展開、不互相重疊。
 */
const JOINT_POS: Record<string, { x: number; y: number; anchor: 'start' | 'end' }> = {
  left_shoulder: { x: 127, y: 78, anchor: 'start' },
  right_shoulder: { x: 73, y: 78, anchor: 'end' },
  left_elbow: { x: 138, y: 122, anchor: 'start' },
  right_elbow: { x: 62, y: 122, anchor: 'end' },
  left_hip: { x: 114, y: 168, anchor: 'start' },
  right_hip: { x: 86, y: 168, anchor: 'end' },
  left_knee: { x: 117, y: 238, anchor: 'start' },
  right_knee: { x: 83, y: 238, anchor: 'end' },
}

/**
 * 人體熱區圖：8 關節（雙肩/肘/髖/膝）依偏差程度上色，一眼看出問題部位。
 * 偏差 = 各關鍵動作當下，病患與範例影片該關節夾角的平均差距（後端 angles.json 統計）。
 *
 * @param deviations 後端 analysis-data 的 joint_deviations；不在 JOINT_POS
 *   映射內的關節名會被靜默略過（前後端關節清單解耦，後端加關節不會炸前端）
 */
export function BodyHeatmap({ deviations }: { deviations: JointDeviation[] }) {
  return (
    <div>
      <div className="flex items-start justify-center gap-2">
        <svg viewBox="0 0 200 320" className="h-64 w-auto select-none" role="img">
          {/* 素體剪影 */}
          <g stroke="#EAE3D8" strokeLinecap="round" fill="none">
            {/* 頭 */}
            <circle cx="100" cy="36" r="17" fill="#EFE8DC" stroke="none" />
            {/* 軀幹 */}
            <path
              d="M 78 66 Q 100 58 122 66 L 118 160 Q 100 168 82 160 Z"
              fill="#EFE8DC"
              stroke="none"
            />
            {/* 手臂（畫面右 = 病患左） */}
            <path d="M 124 76 Q 136 96 138 122 Q 139 140 136 154" strokeWidth="13" />
            <path d="M 76 76 Q 64 96 62 122 Q 61 140 64 154" strokeWidth="13" />
            {/* 腿 */}
            <path d="M 112 164 Q 117 200 117 238 Q 117 270 114 296" strokeWidth="15" />
            <path d="M 88 164 Q 83 200 83 238 Q 83 270 86 296" strokeWidth="15" />
          </g>

          {/* 關節熱點：實心圓上色 + 標籤 + 度數；HIGH 關節加外擴脈衝環吸引注意 */}
          {deviations.map((d, i) => {
            const pos = JOINT_POS[d.joint]
            if (!pos) return null
            const color = heatColor(d.deviation_deg)
            const high = d.status === 'HIGH'
            // 標籤沿 anchor 方向外推 14px，避免壓在關節圓點上
            const labelX = pos.anchor === 'start' ? pos.x + 14 : pos.x - 14
            return (
              <g key={d.joint}>
                {/* 無限循環的脈衝環：delay 依索引錯開，避免所有 HIGH 關節同步閃爍 */}
                {high && (
                  <motion.circle
                    cx={pos.x}
                    cy={pos.y}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    initial={{ r: 9, opacity: 0.7 }}
                    animate={{ r: 15, opacity: 0 }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
                  />
                )}
                <motion.circle
                  cx={pos.x}
                  cy={pos.y}
                  fill={color}
                  initial={{ r: 0 }}
                  animate={{ r: high ? 9 : 7 }}
                  transition={{ delay: 0.3 + i * 0.06, type: 'spring', stiffness: 200 }}
                />
                <text
                  x={labelX}
                  y={pos.y - 2}
                  textAnchor={pos.anchor}
                  fontSize="11"
                  fontWeight={high ? 700 : 400}
                  fill={high ? '#B5543B' : '#8A7B6A'}
                >
                  {d.label}
                </text>
                <text
                  x={labelX}
                  y={pos.y + 11}
                  textAnchor={pos.anchor}
                  fontSize="10"
                  fill={high ? '#B5543B' : '#A99C8D'}
                  className="tabular-nums"
                >
                  {d.deviation_deg}°
                </text>
              </g>
            )
          })}

          <text x="100" y="315" textAnchor="middle" fontSize="9" fill="#C3B8A9">
            正面視角（病患面向你）
          </text>
        </svg>
      </div>

      {/* 圖例：漸層條與 heatColor 的兩段插值對齊（60% 處為琥珀 ≈ 15° 門檻位置） */}
      <div className="mt-2 px-2">
        <div
          className="h-1.5 w-full rounded-full"
          style={{
            background: `linear-gradient(to right, rgb(${GREEN.join(',')}), rgb(${AMBER.join(',')}) 60%, rgb(${RED.join(',')}))`,
          }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-bark-300">
          <span>0°（與範例一致）</span>
          <span className="font-medium text-rust">15° 明顯偏差</span>
          <span>≥25°</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-bark-400">
          偏差 = 各關鍵動作當下，病患與範例影片該關節夾角的平均差距；超過 15°
          代表姿勢明顯不同，建議點下方動作卡對照影片確認。
        </p>
      </div>
    </div>
  )
}
