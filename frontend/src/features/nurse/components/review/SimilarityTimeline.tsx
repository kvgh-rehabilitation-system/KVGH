import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ActionCard, CurvePoint } from '../../../../types'

interface Props {
  /** 後端 analysis-data 的相似度曲線；x 軸用 t_patient（病患原片秒數） */
  curve: CurvePoint[]
  /** 關鍵動作卡，疊成曲線上的參考圓點 */
  actions: ActionCard[]
  /** 點擊曲線任一處的跳轉 callback（父頁面轉呼叫 ComparisonVideoPanel.seekCurvePoint） */
  onSeek: (point: CurvePoint) => void
}

/**
 * 相似度時間軸：病患影片每一刻與範例的相似度曲線。
 * 可看出病患從何時開始走樣、是整段不穩還是特定段落出錯；點曲線跳到影片對應秒數。
 *
 * x 軸刻度顯示的是「病患原片」秒數，但跳轉不能只拿這個數字——CurvePoint 同時帶
 * t_plain / t_full / t_patient 三條時間軸的秒數，由 ComparisonVideoPanel
 * 依當前畫面挑用（合成影片 30fps 寫死、與原片時間軸不同，見根目錄 CLAUDE.md）。
 */
export function SimilarityTimeline({ curve, actions, onSeek }: Props) {
  return (
    <section className="card p-6">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-semibold text-bark-700">相似度時間軸</h2>
        <span className="text-xs text-bark-300">
          曲線越高越貼近範例；圓點為 {actions.length} 個關鍵動作，點任一處跳到影片
        </span>
      </div>
      <div className="cursor-pointer">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart
            data={curve}
            margin={{ top: 10, right: 12, bottom: 0, left: -22 }}
            // recharts 的點擊事件不直接給資料點，只給 tooltip 命中的索引；
            // 轉數字並驗證存在後才回傳整個 CurvePoint（跳轉需要它的多軸秒數）
            onClick={(state) => {
              const i = Number(state?.activeTooltipIndex ?? NaN)
              if (Number.isInteger(i) && curve[i]) onSeek(curve[i])
            }}
          >
            <defs>
              <linearGradient id="simFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C67B5C" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#C67B5C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#EAE3D8" strokeDasharray="4 6" vertical={false} />
            {/* x 軸用 type="number" 而非 category：曲線取樣間隔不保證均勻，
                數值軸才能讓時間比例正確呈現 */}
            <XAxis
              dataKey="t_patient"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => `${Math.round(v)}s`}
              tick={{ fill: '#A99C8D', fontSize: 11 }}
              axisLine={{ stroke: '#EAE3D8' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              tick={{ fill: '#A99C8D', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #EAE3D8',
                borderRadius: 14,
                boxShadow: '0 12px 32px rgba(61,50,41,0.10)',
                fontSize: 12,
              }}
              labelFormatter={(v) => `病患影片 ${Number(v).toFixed(1)}s（點擊跳轉）`}
              formatter={(value) => [`${Math.round(Number(value ?? 0) * 100)}%`, '與範例相似度']}
            />
            {/* 達標參考線（與動作卡同門檻） */}
            <ReferenceLine
              y={0.7}
              stroke="#B5543B"
              strokeDasharray="5 5"
              strokeOpacity={0.5}
              label={{ value: '70%', position: 'right', fill: '#B5543B', fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="similarity"
              stroke="#C67B5C"
              strokeWidth={2}
              fill="url(#simFill)"
              dot={false}
              activeDot={{ r: 5, fill: '#C67B5C' }}
              animationDuration={1100}
              animationEasing="ease-out"
            />
            {/* 關鍵動作標記點：達標（≥70%）綠、未達標紅，與動作卡的達標門檻一致 */}
            {actions.map((a) => (
              <ReferenceDot
                key={a.index}
                x={a.t_patient}
                y={a.similarity}
                r={5}
                fill={a.similarity >= 0.7 ? '#8A9B6E' : '#B5543B'}
                stroke="#FFFFFF"
                strokeWidth={1.5}
                label={{
                  value: `${a.index}`,
                  position: 'top',
                  fill: '#8A7B6A',
                  fontSize: 10,
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
