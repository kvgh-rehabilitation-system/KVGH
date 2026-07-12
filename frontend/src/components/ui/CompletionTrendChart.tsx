import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CompletionTrendPoint } from '../../types'

interface Props {
  data: CompletionTrendPoint[]
  height?: number
}

function barColor(rate: number): string {
  if (rate >= 0.8) return '#8A9B6E'
  if (rate >= 0.5) return '#D9A441'
  return '#DAA78A'
}

/** 週完成率長條圖：實際上傳次數 / 處方次數 */
export function CompletionTrendChart({ data, height = 220 }: Props) {
  const rows = data.map((p) => ({ ...p, percent: Math.round(p.rate * 100) }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="#EAE3D8" strokeDasharray="4 6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#A99C8D', fontSize: 11 }}
          axisLine={{ stroke: '#EAE3D8' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fill: '#A99C8D', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(198,123,92,0.06)' }}
          contentStyle={{
            background: '#FFFFFF',
            border: '1px solid #EAE3D8',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(61,50,41,0.10)',
            fontSize: 12,
          }}
          formatter={(_value, _name, entry) => {
            const p = entry?.payload as (typeof rows)[number] | undefined
            return [p ? `${p.completed} / ${p.prescribed} 次（${p.percent}%）` : '', '完成率']
          }}
        />
        <Bar dataKey="percent" radius={[8, 8, 2, 2]} animationDuration={900} maxBarSize={44}>
          {rows.map((r) => (
            <Cell key={r.week_start} fill={barColor(r.rate)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
