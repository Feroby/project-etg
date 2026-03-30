'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface TrendChartProps {
  data: any[]
  dataKey: string
  color: string
  label: string
  referenceValue?: number
  unit?: string
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-xs">
        <div className="text-white/40 mb-1">{label}</div>
        <div className="text-white font-medium">{payload[0].value}{unit}</div>
      </div>
    )
  }
  return null
}

export default function TrendChart({ data, dataKey, color, label, referenceValue, unit = '' }: TrendChartProps) {
  if (!data.length) {
    return (
      <div className="h-32 flex items-center justify-center text-white/20 text-xs">
        No data yet
      </div>
    )
  }
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">{label}</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#ffffff40' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#ffffff40' }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {referenceValue && (
            <ReferenceLine y={referenceValue} stroke={color} strokeDasharray="3 3" strokeOpacity={0.4} />
          )}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
