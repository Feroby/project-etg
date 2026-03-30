'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Card, MetricCard, FlagBanner } from '@/components/ui'
import TrendChart from '@/components/TrendChart'
import { format, parseISO } from 'date-fns'

function stripMd(text: string): string {
  if (!text) return ''
  return text
    .replace(/#{1,3}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim()
}

function summarise(text: string, chars = 180): string {
  const clean = stripMd(text)
  if (!clean) return ''
  if (clean.length <= chars) return clean
  return clean.slice(0, chars).replace(/\s+\S*$/, '') + '...'
}

function nutritionScore(log: any, settings: any): number | null {
  if (!log?.calories) return null
  let score = 7
  if (settings?.daily_protein && log.protein) {
    const r = log.protein / settings.daily_protein
    if (r >= 0.95) score += 1.5; else if (r < 0.7) score -= 2; else if (r < 0.85) score -= 1
  }
  if (settings?.daily_calories && log.calories) {
    const d = Math.abs(log.calories - settings.daily_calories)
    if (d < 150) score += 1; else if (d > 500) score -= 1.5
  }
  if (settings?.daily_water && log.water) {
    if (log.water >= settings.daily_water) score += 0.5; else if (log.water < settings.daily_water * 0.7) score -= 0.5
  }
  if (log.meal_quality?.includes('Excellent')) score += 0.5
  if (log.meal_quality?.includes('Poor')) score -= 1
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10))
}

function recoveryScore(log: any, settings: any): number | null {
  if (!log?.hrv) return null
  let score = 7
  if (log.whoop_recovery) {
    if (log.whoop_recovery >= 67) score += 2; else if (log.whoop_recovery < 34) score -= 2
  }
  if (settings?.hrv_baseline && log.hrv) {
    const r = log.hrv / settings.hrv_baseline
    if (r >= 1.05) score += 1; else if (r < 0.85) score -= 1.5; else if (r < 0.95) score -= 0.5
  }
  if (log.sleep_hours) {
    const t = settings?.sleep_target || 8
    if (log.sleep_hours >= t) score += 0.5; else if (log.sleep_hours < 6) score -= 2; else if (log.sleep_hours < t - 1) score -= 0.5
  }
  if (log.soreness) {
    if (log.soreness <= 3) score += 0.5; else if (log.soreness >= 8) score -= 1
  }
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10))
}

function strengthScore(session: any): number | null {
  if (!session?.rpe) return null
  let score = 7
  if (session.rpe >= 6 && session.rpe <= 8) score += 1; else if (session.rpe > 9) score -= 1
  if (session.feel?.includes('Strong')) score += 2
  else if (session.feel?.includes('Solid')) score += 1
  else if (session.feel?.includes('Weak')) score -= 1.5
  else if (session.feel?.includes('Incomplete')) score -= 2
  if (session.duration >= 45 && session.duration <= 90) score += 0.5; else if (session.duration < 30) score -= 1
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10))
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 8 ? 'text-etg-green' : score >= 6 ? 'text-white' : 'text-red-400'
  return (
    <div className="flex items-baseline gap-0.5 ml-auto">
      <span className={`text-xl font-semibold ${color}`}>{score}</span>
      <span className="text-[10px] text-white/30">/10</span>
    </div>
  )
}

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
  const logsWithHrv = logs.filter(l => l.hrv)
  const logsWithSleep = logs.filter(l => l.sleep_hours)
  const avgHrv = logsWithHrv.length ? Math.round(logsWithHrv.reduce((a, b) => a + b.hrv, 0) / logsWithHrv.length) : null
  const avgSleep = logsWithSleep.length ? (logsWithSleep.reduce((a, b) => a + b.sleep_hours, 0) / logsWithSleep.length).toFixed(1) : null

  const weightData = logs.filter(l => l.weight).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), weight: l.weight }))
  const hrvData = logsWithHrv.map(l => ({ date: format(parseISO(l.date), 'dd/MM'), hrv: l.hrv }))
  const calData = logs.filter(l => l.calories).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), calories: l.calories }))

  const nutScore = nutritionScore(latest, settings)
  const recScore = recoveryScore(latest, settings)
  const strScore = strengthScore(latestSession)

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center"><div className="text-white/30 text-sm">Loading...</div></main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">

          <div className="mb-5">
            <h1 className="text-xl font-semibold text-white">Dashboard</h1>
            <p className="text-white/40 text-sm mt-0.5">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </div>

          {flags.length > 0 && <FlagBanner flags={flags.map(f => f.message)} />}

          {/* Top metrics */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Latest weight" value={latest?.weight ?? '—'} unit="kg" />
            <MetricCard label="Goal weight" value={settings?.goal_weight ?? '—'} unit="kg" />
            <MetricCard label="HRV today" value={latest?.hrv ?? avgHrv ?? '—'} unit="ms" />
            <MetricCard label="Whoop recovery" value={latest?.whoop_recovery ?? '—'} unit="%" />
          </div>

          {/* Goal progress */}
          {settings?.goal_weight && settings?.current_weight && latest?.weight && (
            <Card className="mb-5">
              <div className="flex justify-between text-xs text-white/40 mb-2">
                <span>Start: {settings.current_weight}kg</span>
                <span className="text-white font-medium">Now: {latest.weight}kg</span>
                <span>Goal: {settings.goal_weight}kg</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-etg-green rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.abs(latest.weight - settings.current_weight) / Math.abs(settings.goal_weight - settings.current_weight) * 100)}%` }} />
              </div>
              <div className="text-xs text-white/30 mt-1.5 text-right">
                {Math.abs(settings.goal_weight - latest.weight).toFixed(1)}kg to goal{settings.target_date ? ` · Target: ${settings.target_date}` : ''}
              </div>
            </Card>
          )}

          {/* 4 coach cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">

            {/* Nutrition */}
            <Card className="border border-etg-green/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-etg-green/20 text-etg-green flex items-center justify-center text-[11px] font-bold flex-shrink-0">N</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">Nutrition coach</div>
                  <div className="text-[10px] text-white/30">Dr. Sarah Mitchell</div>
                </div>
                <ScoreDisplay score={nutScore} />
              </div>
              {latest?.calories && (
                <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                  {[['Cal', latest.calories, ''], ['Protein', latest.protein, 'g'], ['Water', latest.water, 'L'], ['Weight', latest.weight, 'kg']].map(([l, v, u]) => (
                    <div key={l as string} className="bg-white/5 rounded-md p-1.5 text-center">
                      <div className="text-[9px] text-white/30 mb-0.5">{l}</div>
                      <div className="text-xs font-medium text-white">{v ?? '—'}{u}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-white/50 leading-relaxed">
                {summarise(latest?.nutrition_output) || 'No nutrition logs yet.'}
              </p>
            </Card>

            {/* Recovery */}
            <Card className="border border-etg-amber/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-etg-amber/20 text-etg-amber flex items-center justify-center text-[11px] font-bold flex-shrink-0">R</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">Recovery coach</div>
                  <div className="text-[10px] text-white/30">Dr. James Hartley</div>
                </div>
                <ScoreDisplay score={recScore} />
              </div>
              {latest?.hrv && (
                <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                  {[['HRV', latest.hrv, 'ms'], ['RHR', latest.rhr, 'bpm'], ['Sleep', latest.sleep_hours, 'hr'], ['Rec%', latest.whoop_recovery, '%']].map(([l, v, u]) => (
                    <div key={l as string} className="bg-white/5 rounded-md p-1.5 text-center">
                      <div className="text-[9px] text-white/30 mb-0.5">{l}</div>
                      <div className="text-xs font-medium text-white">{v ?? '—'}{u}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-white/50 leading-relaxed">
                {summarise(latest?.recovery_output) || 'No recovery logs yet.'}
              </p>
            </Card>

            {/* Strength */}
            <Card className="border border-etg-blue/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-etg-blue/20 text-etg-blue flex items-center justify-center text-[11px] font-bold flex-shrink-0">S</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">Strength coach</div>
                  <div className="text-[10px] text-white/30">Dr. Marcus Reid</div>
                </div>
                <ScoreDisplay score={strScore} />
              </div>
              {latestSession && (
                <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                  {[['RPE', `${latestSession.rpe}/10`, ''], ['Duration', latestSession.duration, 'min'], ['Feel', latestSession.feel?.split('—')[0]?.trim(), '']].map(([l, v, u]) => (
                    <div key={l as string} className="bg-white/5 rounded-md p-1.5 text-center">
                      <div className="text-[9px] text-white/30 mb-0.5">{l}</div>
                      <div className="text-xs font-medium text-white truncate">{v ?? '—'}{u}</div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-white/50 leading-relaxed">
                {summarise(latestSession?.coach_output) || 'No sessions logged yet.'}
              </p>
            </Card>

            {/* Central */}
            <Card className="border border-etg-purple/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-etg-purple text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">C</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">Central coach</div>
                  <div className="text-[10px] text-white/30">Head performance coach</div>
                </div>
              </div>
              {(nutScore || recScore || strScore) && (
                <div className="flex gap-1.5 mb-2.5 flex-wrap">
                  {nutScore && <div className="bg-etg-green/10 text-etg-green text-[10px] font-medium px-2 py-1 rounded-md">Nutrition {nutScore}/10</div>}
                  {recScore && <div className="bg-etg-amber/10 text-etg-amber text-[10px] font-medium px-2 py-1 rounded-md">Recovery {recScore}/10</div>}
                  {strScore && <div className="bg-etg-blue/10 text-etg-blue text-[10px] font-medium px-2 py-1 rounded-md">Strength {strScore}/10</div>}
                </div>
              )}
              <p className="text-xs text-white/50 leading-relaxed">
                {summarise(latest?.central_output) || 'No synthesis yet. Submit logs to activate the central coach.'}
              </p>
            </Card>

          </div>

          {/* Trend charts */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <TrendChart data={weightData} dataKey="weight" color="#1D9E75" label="Body weight (kg)" referenceValue={settings?.goal_weight} unit="kg" />
            </Card>
            <Card>
              <TrendChart data={hrvData} dataKey="hrv" color="#BA7517" label="HRV (ms)" referenceValue={settings?.hrv_minimum} unit="ms" />
            </Card>
            <Card>
              <TrendChart data={calData} dataKey="calories" color="#63991a" label="Daily calories" referenceValue={settings?.daily_calories} unit="kcal" />
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
