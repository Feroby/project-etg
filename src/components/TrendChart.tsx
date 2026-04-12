'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface TrendChartProps {
  data: any[]; dataKey: string; color: string; label: string; referenceValue?: number; unit?: string
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/15 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-white/55 mb-1 font-medium">{label}</div>
      <div className="text-white font-semibold text-sm">{payload[0].value}{unit}</div>
    </div>
  )
}

export default function TrendChart({ data, dataKey, color, label, referenceValue, unit = '' }: TrendChartProps) {
  if (!data.length) {
    return <div className="h-32 flex items-center justify-center text-white/35 text-sm">No data yet</div>
  }
  const values = data.map(d => d[dataKey]).filter((v): v is number => v != null)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || max * 0.1 || 1
  const pad = range * 0.15
  const yMin = Math.floor(min - pad)
  const yMax = Math.ceil(max + pad)

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-white/55 mb-3 font-semibold">{label}</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#ffffff66' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#ffffff66' }} tickLine={false} axisLine={false} domain={[yMin, yMax]} />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {referenceValue && (
            <ReferenceLine y={referenceValue} stroke={color} strokeDasharray="3 3" strokeOpacity={0.5} />
          )}
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
            dot={{ fill: color, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
