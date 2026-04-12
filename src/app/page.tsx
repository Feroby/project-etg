'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Card, MetricCard, FlagBanner, CoachAvatar, ACCENT_TEXT, ACCENT_BG_SUBTLE } from '@/components/ui'
import TrendChart from '@/components/TrendChart'
import { format, parseISO } from 'date-fns'

// ─── UTILS ────────────────────────────────────────────────────────────────────

function stripMd(text: string): string {
  if (!text) return ''
  return text
    .replace(/#{1,3}\s+/g, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '').replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ').replace(/\n/g, ' ').trim()
}
function summarise(text: string, chars = 180): string {
  const s = stripMd(text)
  if (!s) return ''
  return s.length <= chars ? s : s.slice(0, chars).replace(/\s+\S*$/, '') + '…'
}

// ─── SCORING ──────────────────────────────────────────────────────────────────

function nutritionScore(log: any, settings: any): number | null {
  if (!log?.calories) return null
  let s = 7
  if (settings?.daily_protein && log.protein) {
    const r = log.protein / settings.daily_protein
    if (r >= 0.95) s += 1.5; else if (r < 0.7) s -= 2; else if (r < 0.85) s -= 1
  }
  if (settings?.daily_calories && log.calories) {
    const d = Math.abs(log.calories - settings.daily_calories)
    if (d < 150) s += 1; else if (d > 500) s -= 1.5
  }
  if (settings?.daily_water && log.water) {
    if (log.water >= settings.daily_water) s += 0.5; else if (log.water < settings.daily_water * 0.7) s -= 0.5
  }
  if (log.meal_quality?.includes('Excellent')) s += 0.5
  if (log.meal_quality?.includes('Poor')) s -= 1
  return Math.min(10, Math.max(1, Math.round(s * 10) / 10))
}

function recoveryScore(log: any, settings: any): number | null {
  if (!log?.hrv) return null
  let s = 7
  if (log.whoop_recovery) {
    if (log.whoop_recovery >= 67) s += 2; else if (log.whoop_recovery < 34) s -= 2
  }
  if (settings?.hrv_baseline && log.hrv) {
    const r = log.hrv / settings.hrv_baseline
    if (r >= 1.05) s += 1; else if (r < 0.85) s -= 1.5; else if (r < 0.95) s -= 0.5
  }
  if (log.sleep_hours) {
    const t = settings?.sleep_target || 8
    if (log.sleep_hours >= t) s += 0.5; else if (log.sleep_hours < 6) s -= 2; else if (log.sleep_hours < t - 1) s -= 0.5
  }
  if (log.soreness) {
    if (log.soreness <= 3) s += 0.5; else if (log.soreness >= 8) s -= 1
  }
  return Math.min(10, Math.max(1, Math.round(s * 10) / 10))
}

function strengthScore(session: any): number | null {
  if (!session) return null
  let s = 7
  if (session.rpe) {
    if (session.rpe >= 6 && session.rpe <= 8) s += 1; else if (session.rpe > 9) s -= 1
  }
  if (session.feel?.includes('Strong')) s += 2
  else if (session.feel?.includes('Solid')) s += 1
  else if (session.feel?.includes('Weak')) s -= 1.5
  else if (session.feel?.includes('Incomplete')) s -= 2
  if (session.duration && session.duration >= 45 && session.duration <= 90) s += 0.5
  else if (session.duration && session.duration < 30) s -= 1
  return Math.min(10, Math.max(1, Math.round(s * 10) / 10))
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function Score({ score }: { score: number | null }) {
  if (score === null) return null
  const color = score >= 8 ? 'text-etg-green' : score >= 6 ? 'text-white/90' : 'text-red-400'
  return (
    <div className="flex items-baseline gap-0.5 ml-auto flex-shrink-0">
      <span className={`text-2xl font-bold ${color}`}>{score}</span>
      <span className="text-xs text-white/35 font-normal">/10</span>
    </div>
  )
}

// Mini stat chip used inside coach cards
function StatChip({ label, value, unit }: { label: string; value: any; unit?: string }) {
  return (
    <div className="bg-white/8 rounded-md p-2 text-center">
      <div className="text-[10px] text-white/50 mb-0.5 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-white/90 truncate">
        {value ?? '—'}{unit}
      </div>
    </div>
  )
}

type CoachKey = 'N' | 'R' | 'S' | 'C'
const COACH_META: Record<CoachKey, { color: 'green' | 'blue' | 'amber' | 'purple'; name: string; title: string }> = {
  N: { color: 'green',  name: 'Nutrition coach',   title: 'Dr. Sarah Mitchell' },
  R: { color: 'amber',  name: 'Recovery coach',    title: 'Dr. James Hartley' },
  S: { color: 'blue',   name: 'Strength coach',    title: 'Dr. Marcus Reid' },
  C: { color: 'purple', name: 'Central coach',     title: 'Head performance coach' },
}

function CoachCard({ coachKey, score, chips, summary }: {
  coachKey: CoachKey
  score: number | null
  chips?: React.ReactNode
  summary: string
}) {
  const meta = COACH_META[coachKey]
  return (
    <Card className={`border ${ACCENT_TEXT[meta.color].replace('text-', 'border-')}/30`}>
      <div className="flex items-center gap-2.5 mb-3">
        <CoachAvatar coach={coachKey} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white/90">{meta.name}</div>
          <div className="text-xs text-white/45">{meta.title}</div>
        </div>
        <Score score={score} />
      </div>
      {chips && <div className="mb-2.5">{chips}</div>}
      <p className="text-sm text-white/65 leading-relaxed">
        {summary || `No ${meta.name.toLowerCase()} data yet.`}
      </p>
    </Card>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

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
      setLogs(l || []); setSessions(s || []); setSettings(st); setFlags(f || [])
      setLoading(false)
    }
    load()
  }, [])

  const latest = logs[logs.length - 1]
  const latestSession = sessions[0]

  const nutScore = nutritionScore(latest, settings)
  const recScore = recoveryScore(latest, settings)
  const strScore = strengthScore(latestSession)

  const weightData = logs.filter(l => l.weight).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), weight: l.weight }))
  const hrvData    = logs.filter(l => l.hrv).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), hrv: l.hrv }))
  const calData    = logs.filter(l => l.calories).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), calories: l.calories }))

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center">
        <div className="text-white/45 text-sm">Loading...</div>
      </main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">

          <header className="mb-6">
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-white/45 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
          </header>

          {flags.length > 0 && <FlagBanner flags={flags.map(f => f.message)} />}

          {/* Top metrics */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Latest weight" value={latest?.weight ?? '—'} unit="kg" />
            <MetricCard label="Goal weight"   value={settings?.goal_weight ?? '—'} unit="kg" />
            <MetricCard label="HRV today"     value={latest?.hrv ?? '—'} unit="ms" />
            <MetricCard label="Whoop recovery" value={latest?.whoop_recovery ?? '—'} unit="%" />
          </div>

          {/* Goal progress */}
          {settings?.goal_weight && settings?.current_weight && latest?.weight && (() => {
            const pct = Math.min(100,
              Math.abs(latest.weight - settings.current_weight) /
              Math.abs(settings.goal_weight - settings.current_weight) * 100
            )
            const remaining = Math.abs(settings.goal_weight - latest.weight).toFixed(1)
            return (
              <Card className="mb-5">
                <div className="flex justify-between text-xs text-white/50 mb-2.5 font-medium">
                  <span>Start: {settings.current_weight}kg</span>
                  <span className="text-white font-semibold">Now: {latest.weight}kg</span>
                  <span>Goal: {settings.goal_weight}kg</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-etg-green rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-white/40 mt-2 text-right font-medium">
                  {remaining}kg to goal{settings.target_date ? ` · Target: ${settings.target_date}` : ''}
                </div>
              </Card>
            )
          })()}

          {/* Coach cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <CoachCard coachKey="N" score={nutScore}
              chips={latest?.calories && (
                <div className="grid grid-cols-4 gap-1.5">
                  {([['Cal', latest.calories, ''], ['Protein', latest.protein, 'g'], ['Water', latest.water, 'L'], ['Weight', latest.weight, 'kg']] as const).map(([l, v, u]) => (
                    <StatChip key={l} label={l} value={v} unit={u} />
                  ))}
                </div>
              )}
              summary={summarise(latest?.nutrition_output)}
            />

            <CoachCard coachKey="R" score={recScore}
              chips={latest?.hrv && (
                <div className="grid grid-cols-4 gap-1.5">
                  {([['HRV', latest.hrv, 'ms'], ['RHR', latest.rhr, 'bpm'], ['Sleep', latest.sleep_hours, 'hr'], ['Rec%', latest.whoop_recovery, '%']] as const).map(([l, v, u]) => (
                    <StatChip key={l} label={l} value={v} unit={u} />
                  ))}
                </div>
              )}
              summary={summarise(latest?.recovery_output)}
            />

            <CoachCard coachKey="S" score={strScore}
              chips={latestSession && (
                <div className="grid grid-cols-3 gap-1.5">
                  {([['RPE', `${latestSession.rpe}/10`, ''], ['Duration', latestSession.duration, 'min'], ['Feel', latestSession.feel?.split('—')[0]?.trim(), '']] as const).map(([l, v, u]) => (
                    <StatChip key={l} label={l} value={v} unit={u} />
                  ))}
                </div>
              )}
              summary={summarise(latestSession?.coach_output)}
            />

            <CoachCard coachKey="C" score={null}
              chips={(nutScore || recScore || strScore) ? (
                <div className="flex gap-2 flex-wrap">
                  {nutScore && <span className="text-xs font-semibold bg-etg-green/15 text-etg-green px-2.5 py-1 rounded-md">Nutrition {nutScore}/10</span>}
                  {recScore && <span className="text-xs font-semibold bg-etg-amber/15 text-etg-amber px-2.5 py-1 rounded-md">Recovery {recScore}/10</span>}
                  {strScore && <span className="text-xs font-semibold bg-etg-blue/15 text-etg-blue px-2.5 py-1 rounded-md">Strength {strScore}/10</span>}
                </div>
              ) : undefined}
              summary={summarise(latest?.central_output) || 'Submit logs to activate the central coach.'}
            />
          </div>

          {/* Trend charts */}
          <div className="grid grid-cols-3 gap-3">
            <Card><TrendChart data={weightData} dataKey="weight" color="#1D9E75" label="Body weight (kg)" referenceValue={settings?.goal_weight} unit="kg" /></Card>
            <Card><TrendChart data={hrvData}    dataKey="hrv"    color="#BA7517" label="HRV (ms)"         referenceValue={settings?.hrv_minimum} unit="ms" /></Card>
            <Card><TrendChart data={calData}    dataKey="calories" color="#63991a" label="Daily calories" referenceValue={settings?.daily_calories} unit="kcal" /></Card>
          </div>

        </div>
      </main>
    </div>
  )
}
