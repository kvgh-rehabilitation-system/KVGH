import { Bot } from 'lucide-react'
import { ScoreRadial } from '../../../../components/ui/ScoreRadial'
import type { Analysis } from '../../../../types'
import { BodyHeatmap } from './BodyHeatmap'

/**
 * 演算法分析面板：四分數環 + 自動判讀文字 + 人體熱區圖。
 * summary_text 是演算法輸出的自動判讀，不是護理師評論（護理師回饋在 ReviewSection）。
 */
export function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  return (
    <section className="card p-6">
      <h2 className="mb-5 text-base font-semibold text-bark-700">演算法分析</h2>
      <ScoreRadial
        overall={analysis.overall_score}
        jointAngle={analysis.joint_angle_score}
        stability={analysis.stability_score}
        posture={analysis.posture_score}
      />

      {analysis.summary_text && (
        <div className="mt-5 rounded-xl bg-parchment/70 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-bark-400">
            <Bot size={13} className="text-clay-500" /> 演算法自動判讀
          </div>
          <p className="text-sm leading-relaxed text-bark-600">{analysis.summary_text}</p>
        </div>
      )}

      <h3 className="mb-1 mt-6 text-sm font-medium text-bark-600">關節角度偏差</h3>
      <BodyHeatmap deviations={analysis.metrics.joint_deviations} />
    </section>
  )
}
