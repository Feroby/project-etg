'use client'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Card, MetricCard, Badge } from '@/components/ui'
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

type UsageEntry = {
  id: string
  coach: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  estimated_cost_usd: number
  created_at: string
}

const coachColors: Record<string, string> = {
  nutrition: 'green',
  recovery: 'amber',
  strength: 'blue',
  central: 'purple',
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/usage')
      .then(r => r.json())
      .then(d => { setUsage(d.usage || []); setLoading(false) })
  }, [])

  const totalCost = usage.reduce((a, b) => a + (b.estimated_cost_usd || 0), 0)
  const totalTokens = usage.reduce((a, b) => a + (b.total_tokens || 0), 0)

  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const thisMonth = usage.filter(u => {
    try { return isWithinInterval(parseISO(u.created_at), { start: monthStart, end: monthEnd }) }
    catch { return false }
  })
  const monthCost = thisMonth.reduce((a, b) => a + (b.estimated_cost_usd || 0), 0)
  const monthTokens = thisMonth.reduce((a, b) => a + (b.total_tokens || 0), 0)

  // Per coach breakdown
  const byCoach = ['nutrition', 'recovery', 'strength', 'central'].map(coach => {
    const entries = usage.filter(u => u.coach === coach)
    return {
      coach,
      calls: entries.length,
      tokens: entries.reduce((a, b) => a + b.total_tokens, 0),
      cost: entries.reduce((a, b) => a + b.estimated_cost_usd, 0),
    }
  })

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center"><div className="text-white/30 text-sm">Loading...</div></main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">

          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">API usage</h1>
            <p className="text-white/40 text-sm mt-0.5">Estimated cost based on Claude Sonnet pricing — $3/M input tokens, $15/M output tokens</p>
          </div>

          {/* Summary metrics */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <MetricCard label="This month" value={`$${monthCost.toFixed(3)}`} />
            <MetricCard label="Month tokens" value={monthTokens.toLocaleString()} />
            <MetricCard label="All time cost" value={`$${totalCost.toFixed(3)}`} />
            <MetricCard label="Total API calls" value={usage.length} />
          </div>

          {/* Monthly projection */}
          {monthCost > 0 && (
            <Card className="mb-6">
              <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Monthly projection</div>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-medium text-white">
                  ${(monthCost / now.getDate() * 30).toFixed(2)}
                </div>
                <div className="text-sm text-white/40 mb-0.5">estimated this month</div>
              </div>
              <div className="text-xs text-white/30 mt-1">
                Based on ${(monthCost / now.getDate()).toFixed(4)}/day average so far this month
              </div>
              <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-etg-purple rounded-full"
                  style={{ width: `${Math.min(100, (monthCost / 5) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/20 mt-1">
                <span>$0</span>
                <span>$5 budget</span>
              </div>
            </Card>
          )}

          {/* Per coach breakdown */}
          <Card className="mb-6">
            <div className="text-xs text-white/30 uppercase tracking-wider mb-4">Breakdown by coach</div>
            <div className="space-y-3">
              {byCoach.map(c => (
                <div key={c.coach} className="flex items-center gap-3">
                  <div className="w-24 capitalize text-sm text-white/60">{c.coach}</div>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: totalTokens > 0 ? `${(c.tokens / totalTokens) * 100}%` : '0%',
                        background: c.coach === 'nutrition' ? '#1D9E75' : c.coach === 'recovery' ? '#BA7517' : c.coach === 'strength' ? '#378ADD' : '#533AB7'
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-xs text-white/40">{c.calls} calls</div>
                  <div className="w-16 text-right text-xs text-white/60">${c.cost.toFixed(4)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent calls log */}
          <Card>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-4">Recent API calls</div>
            {usage.length === 0 ? (
              <div className="text-white/20 text-sm text-center py-6">No API calls logged yet.</div>
            ) : (
              <div className="space-y-2">
                {usage.slice(0, 30).map(u => (
                  <div key={u.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/5 last:border-0">
                    <div className="w-28 text-white/30 flex-shrink-0">
                      {format(parseISO(u.created_at), 'dd MMM · HH:mm')}
                    </div>
                    <Badge color={coachColors[u.coach] as any}>{u.coach}</Badge>
                    <div className="flex-1 text-white/30">{u.total_tokens.toLocaleString()} tokens</div>
                    <div className="text-white/50 font-medium">${u.estimated_cost_usd.toFixed(5)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>
      </main>
    </div>
  )
}
