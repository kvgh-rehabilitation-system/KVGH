import { Sparkles } from 'lucide-react'

/**
 * AI 智慧分析報告：未來由 LLM 整合演算法數據自動產生判讀摘要。
 * 目前後端 ai_report 為 null 時顯示預告卡（欄位與版面已預留）。
 */
export function AiReportCard({ report }: { report: string | null }) {
  return (
    <section className="card p-6">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles size={17} className="text-clay-500" />
        <h2 className="text-base font-semibold text-bark-700">AI 智慧分析報告</h2>
        {!report && (
          <span className="rounded-full bg-parchment px-2.5 py-0.5 text-[11px] text-bark-400">
            即將推出
          </span>
        )}
      </div>
      {report ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-bark-600">{report}</p>
      ) : (
        <p className="text-sm leading-relaxed text-bark-400">
          未來將由 AI
          整合動作分解、關節偏差與歷次趨勢等數據，自動產生判讀摘要與回饋建議，
          協助你不必完整看完影片即可完成審核。
        </p>
      )}
    </section>
  )
}
