import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ScoreTrendPoint } from '../../types'
import { formatDate } from '../../utils/format'

interface Props {
  data: ScoreTrendPoint[]
  height?: number
  /** 顯示四條分項曲線（預設只畫整體分數） */
  detailed?: boolean
}

const seriesConfig = [
  { key: 'overall', name: '整體分數', color: '#C67B5C', width: 2.5 },
  { key: 'joint_angle', name: '關節角度', color: '#8A9B6E', width: 1.5 },
  { key: 'stability', name: '穩定度', color: '#D9A441', width: 1.5 },
  { key: 'posture', name: '姿勢', color: '#8A7B6A', width: 1.5 },
] as const

/** 演算法分數趨勢圖：暖色漸層 + draw-in 動畫 */
export function ScoreTrendChart({ data, height = 220, detailed = false }: Props) {
  const rows = data.map((p) => ({ ...p, label: formatDate(p.date).slice(5) }))
  const series = detailed ? seriesConfig : seriesConfig.slice(0, 1)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C67B5C" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#C67B5C" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#EAE3D8" strokeDasharray="4 6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#A99C8D', fontSize: 11 }}
          axisLine={{ stroke: '#EAE3D8' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
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
          labelStyle={{ color: '#8A7B6A' }}
          formatter={(value, name) => [`${Number(value ?? 0)} 分`, String(name)]}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={s.width}
            fill={s.key === 'overall' ? 'url(#scoreFill)' : 'transparent'}
            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            animationDuration={1100}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
