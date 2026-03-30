'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Card, MetricCard, FlagBanner, Badge } from '@/components/ui'
import TrendChart from '@/components/TrendChart'
import { format, parseISO } from 'date-fns'

export default function Dashboard() {
  const [logs, setLogs] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [flags, setFlags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: s }, { data: st }, { data: f }] = await Promise.all([
        supabase.from('daily_logs').select('*').order('date', { ascending: true }).limit(30),
        supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
        supabase.from('settings').select('*').single(),
        supabase.from('guardrail_flags').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(5),
      ])
      setLogs(l || [])
      setSessions(s || [])
      setSettings(st)
      setFlags(f || [])
      setLoading(false)
    }
    load()
  }, [])

  const latest = logs[logs.length - 1]
  const latestSession = sessions[0]
  const avgHrv = logs.length ? Math.round(logs.reduce((a, b) => a + (b.hrv || 0), 0) / logs.filter(l => l.hrv).length) : null
  const avgSleep = logs.length ? (logs.reduce((a, b) => a + (b.sleep_hours || 0), 0) / logs.filter(l => l.sleep_hours).length).toFixed(1) : null

  const weightData = logs.filter(l => l.weight).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), weight: l.weight }))
  const hrvData = logs.filter(l => l.hrv).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), hrv: l.hrv }))

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="ml-52 flex-1 flex items-center justify-center">
          <div className="text-white/30 text-sm">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            <p className="text-white/40 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>

          {/* Guardrail flags */}
          {flags.length > 0 && (
            <FlagBanner flags={flags.map(f => f.message)} />
          )}

          {/* Key metrics */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <MetricCard label="Latest weight" value={latest?.weight ?? '—'} unit="kg" />
            <MetricCard label="Goal weight" value={settings?.goal_weight ?? '—'} unit="kg" />
            <MetricCard label="Avg HRV" value={avgHrv ?? '—'} unit="ms" />
            <MetricCard label="Avg sleep" value={avgSleep ?? '—'} unit="hr" />
          </div>

          {/* Goal progress bar */}
          {settings?.goal_weight && settings?.current_weight && latest?.weight && (
            <Card className="mb-6">
              <div className="flex justify-between text-xs text-white/40 mb-2">
                <span>Start: {settings.current_weight}kg</span>
                <span className="text-white font-medium">Now: {latest.weight}kg</span>
                <span>Goal: {settings.goal_weight}kg</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-etg-green rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.abs(latest.weight - settings.current_weight) / Math.abs(settings.goal_weight - settings.current_weight) * 100)}%`
                  }}
                />
              </div>
              <div className="text-xs text-white/30 mt-1.5 text-right">
                {Math.abs(settings.goal_weight - latest.weight).toFixed(1)}kg to goal
                {settings.target_date ? ` · Target: ${settings.target_date}` : ''}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Weight trend */}
            <Card>
              <TrendChart
                data={weightData}
                dataKey="weight"
                color="#1D9E75"
                label="Body weight (kg)"
                referenceValue={settings?.goal_weight}
                unit="kg"
              />
            </Card>
            {/* HRV trend */}
            <Card>
              <TrendChart
                data={hrvData}
                dataKey="hrv"
                color="#BA7517"
                label="HRV (ms)"
                referenceValue={settings?.hrv_minimum}
                unit="ms"
              />
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Latest central coach output */}
            <Card accent="purple">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-etg-purple flex items-center justify-center text-[10px] font-bold text-white">C</div>
                <span className="text-xs font-medium text-white">Central coach — latest synthesis</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                {latest?.central_output || 'No synthesis yet. Submit your first daily log to get started.'}
              </p>
            </Card>

            {/* Latest strength session */}
            <Card accent="blue">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-etg-blue/20 flex items-center justify-center text-[10px] font-bold text-etg-blue">S</div>
                <span className="text-xs font-medium text-white">Last strength session</span>
                {latestSession && <Badge color="blue">{latestSession.day_type?.split('—')[0]?.trim()}</Badge>}
              </div>
              {latestSession ? (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <MetricCard label="RPE" value={latestSession.rpe} unit="/10" />
                    <MetricCard label="Duration" value={latestSession.duration} unit="min" />
                    <MetricCard label="Feel" value={latestSession.feel?.split('—')[0]?.trim() ?? '—'} />
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed line-clamp-3">{latestSession.coach_output}</p>
                </>
              ) : (
                <p className="text-sm text-white/30">No sessions logged yet.</p>
              )}
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
