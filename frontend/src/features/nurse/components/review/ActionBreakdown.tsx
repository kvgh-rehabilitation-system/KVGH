import { motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, PlayCircle } from 'lucide-react'
import type { ActionCard } from '../../../../types'

/** 與比對影片的綠/紅標註一致的達標門檻（SimilarityTimeline 的參考線也是 0.7） */
const PASS_SIMILARITY = 0.7

interface Props {
  /** 後端 analysis-data 的關鍵動作卡（含各時間軸的預算秒數） */
  actions: ActionCard[]
  /** 點卡片時的跳轉 callback（父頁面轉呼叫 ComparisonVideoPanel.seekAction） */
  onSeek: (action: ActionCard) => void
}

/**
 * 動作分解卡：演算法（TALMA）將整段影片對齊成 N 個關鍵動作，
 * 每張卡顯示該動作與範例的相似度，點擊直接跳到比對影片的對應段落。
 * 卡上顯示的秒數僅供人眼參考；實際跳轉用 ActionCard 內各時間軸的預算值。
 */
export function ActionBreakdown({ actions, onSeek }: Props) {
  return (
    <section className="card p-6">
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-semibold text-bark-700">動作分解</h2>
        <span className="text-xs text-bark-300">
          演算法已將影片對齊成 {actions.length} 個關鍵動作，點卡片跳到影片對應段落
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {actions.map((a, i) => {
          // 達標與否決定整張卡的配色（綠系/紅系）與圖示
          const pass = a.similarity >= PASS_SIMILARITY
          const pct = Math.round(a.similarity * 100)
          return (
            <motion.button
              key={a.index}
              onClick={() => onSeek(a)}
              // 進場動畫依索引錯開，形成由左至右的波浪出現效果
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              whileHover={{ y: -3 }}
              className={`group rounded-2xl border p-4 text-left transition-colors ${
                pass
                  ? 'border-sage-200 bg-sage-50/50 hover:border-sage-400'
                  : 'border-rust/25 bg-[#FBF5F3] hover:border-rust/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-bark-400">動作 {a.index}</span>
                {pass ? (
                  <CheckCircle2 size={15} className="text-sage-600" />
                ) : (
                  <CircleAlert size={15} className="text-rust" />
                )}
              </div>
              <div
                className={`mt-2 text-2xl font-semibold tabular-nums ${
                  pass ? 'text-sage-700' : 'text-rust'
                }`}
              >
                {pct}
                <span className="ml-0.5 text-sm font-normal">%</span>
              </div>
              <div className="mt-0.5 text-[11px] text-bark-300">
                相似度・{pass ? '達標' : '未達標'}
              </div>
              {/* t_mentor 可能為 null（該步驟導師端已凍結、無對應時間點）→ 只顯示病患秒數 */}
              <div className="mt-3 flex items-center gap-1 text-[11px] text-bark-400 transition-colors group-hover:text-clay-600">
                <PlayCircle size={13} />
                病患 {a.t_patient.toFixed(1)}s
                {a.t_mentor != null && <>・範例 {a.t_mentor.toFixed(1)}s</>}
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
