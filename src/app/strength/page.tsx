'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import { Card, MetricCard, Button, Input, Select, Textarea, Divider, Tabs, Spinner, Badge } from '@/components/ui'
import { format, parseISO } from 'date-fns'

const WEEK1_PROGRAM = [
  { day: 'Day 1 — Lower (squat focus)', exercises: [{ name: 'Low bar back squat', sets: '4', reps: '5', rpe: '6', notes: '~80-90kg, slow descent' },{ name: 'Romanian deadlift', sets: '3', reps: '8', rpe: '6', notes: 'Hinge pattern, not heavy' },{ name: 'Leg press', sets: '3', reps: '10', rpe: '6', notes: 'Full range, controlled' },{ name: 'Leg curl', sets: '3', reps: '10', rpe: '6', notes: '' },{ name: 'Dead bug', sets: '3', reps: '10/side', rpe: '—', notes: 'Core stability' }] },
  { day: 'Day 2 — Upper (bench heavy)', exercises: [{ name: 'Bench press', sets: '5', reps: '3', rpe: '7-8', notes: '~90-92kg, main bench day' },{ name: 'Incline DB press', sets: '3', reps: '8', rpe: '7', notes: '' },{ name: 'Barbell row', sets: '4', reps: '6', rpe: '7', notes: 'Horizontal pull balance' },{ name: 'Face pulls', sets: '3', reps: '15', rpe: '6', notes: 'Shoulder health' },{ name: 'Tricep pushdown', sets: '3', reps: '12', rpe: '6', notes: '' }] },
  { day: 'Day 3 — Lower (hinge + squat accessory)', exercises: [{ name: 'Romanian deadlift', sets: '4', reps: '6', rpe: '6-7', notes: 'Slightly heavier than day 1' },{ name: 'Goblet squat', sets: '3', reps: '8', rpe: '5', notes: 'Light, pause at bottom — mobility' },{ name: 'Walking lunges', sets: '3', reps: '8/leg', rpe: '6', notes: '' },{ name: 'Leg curl', sets: '3', reps: '10', rpe: '6', notes: '' },{ name: 'Ab wheel / plank', sets: '3', reps: '—', rpe: '—', notes: '' }] },
  { day: 'Day 4 — Optional: Bench volume + accessories', exercises: [{ name: 'Bench press', sets: '4', reps: '5', rpe: '6-7', notes: '~82-85kg, volume not intensity' },{ name: 'Overhead press', sets: '3', reps: '8', rpe: '7', notes: '' },{ name: 'Lat pulldown', sets: '3', reps: '10', rpe: '6', notes: '' },{ name: 'Bicep curl', sets: '3', reps: '12', rpe: '6', notes: '' },{ name: 'Tricep superset', sets: '3', reps: '12', rpe: '6', notes: '' }] },
]

export default function StrengthPage() {
  const [tab, setTab] = useState('log')
  const [sessions, setSessions] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [todaySession, setTodaySession] = useState<any>(null)
  const [lastSession, setLastSession] = useState<any>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: l }, { data: ch }] = await Promise.all([
        supabase.from('strength_sessions').select('*').order('date', { ascending: true }),
        supabase.from('daily_logs').select('*').order('date', { ascending: true }),
        supabase.from('chat_messages').select('*').eq('coach', 'strength').order('created_at', { ascending: true }).limit(100),
      ])
      setSessions(s || [])
      setLogs(l || [])
      setChatHistory((ch || []).map(m => ({ role: m.role, content: m.content })))
      const todayS = (s || []).find((x: any) => x.date === today)
      setTodaySession(todayS || null)
      const past = (s || []).filter((x: any) => x.date < today).sort((a: any, b: any) => b.date.localeCompare(a.date))
      setLastSession(past[0] || null)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    const fd = new FormData(e.currentTarget)
    const body = {
      date: today,
      week_number: parseInt(fd.get('week_number') as string) || 1,
      day_type: fd.get('day_type'),
      rpe: parseFloat(fd.get('rpe') as string) || null,
      duration: parseInt(fd.get('duration') as string) || null,
      feel: fd.get('feel'),
      session_detail: fd.get('session_detail'),
      session_notes: fd.get('session_notes'),
    }
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).then(data => {
      setResult(data)
      setTodaySession(body)
      supabase.from('strength_sessions').select('*').order('date', { ascending: true }).then(({ data: s }) => setSessions(s || []))
    }).catch(() => setResult({ error: 'Submission failed. Please try again.' }))
    .finally(() => setSubmitting(false))
  }

  const avgRpe = sessions.length ? (sessions.reduce((a, b) => a + (b.rpe || 0), 0) / sessions.filter(s => s.rpe).length).toFixed(1) : null
  const rpeData = sessions.filter(s => s.rpe).map(s => ({ date: format(parseISO(s.date), 'dd/MM'), rpe: s.rpe }))
  const durData = sessions.filter(s => s.duration).map(s => ({ date: format(parseISO(s.date), 'dd/MM'), duration: s.duration }))
  const alreadyLoggedToday = !!todaySession?.day_type

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center"><div className="text-white/30 text-sm">Loading...</div></main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-etg-blue/20 flex items-center justify-center text-sm font-bold text-etg-blue">S</div>
            <div><h1 className="text-lg font-semibold text-white">Strength Coach</h1><p className="text-xs text-white/40">Dr. Marcus Reid · PhD Exercise Science, CSCS</p></div>
            <Badge color="blue">{sessions.length} sessions logged</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <MetricCard label="Sessions" value={sessions.length} />
            <MetricCard label="Avg RPE" value={avgRpe ?? '—'} unit="/10" />
            <MetricCard label="Current block" value="Week 1 · Squat Reintro" />
          </div>
          <Tabs tabs={[{ id: 'log', label: 'Log session' }, { id: 'program', label: 'Week 1 program' }, { id: 'chat', label: 'Chat' }, { id: 'trends', label: 'Trends' }, { id: 'history', label: 'History' }]} active={tab} onChange={setTab} />

          {tab === 'log' && (
            <Card accent="blue">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-white/40">{format(new Date(), 'EEEE, d MMMM yyyy')}</div>
                {alreadyLoggedToday && !submitting && <div className="text-xs bg-etg-blue/20 text-etg-blue px-2 py-0.5 rounded-full">Session logged today ✓</div>}
                {submitting && <div className="text-xs text-white/40 flex items-center gap-1"><Spinner size="sm" /> Saving in background...</div>}
              </div>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Input label="Week number" id="week_number" type="number" placeholder="1" min="1" max="6" />
                    {lastSession?.week_number && <div className="text-[10px] text-white/25 mt-1">Last session: Week {lastSession.week_number}</div>}
                  </div>
                  <div>
                    <Select label="Session day" id="day_type" options={[{value:'Day 1 — Lower (squat focus)',label:'Day 1 — Lower (squat focus)'},{value:'Day 2 — Upper (bench heavy)',label:'Day 2 — Upper (bench heavy)'},{value:'Day 3 — Lower (hinge + squat accessory)',label:'Day 3 — Lower (hinge + squat accessory)'},{value:'Day 4 — Optional upper + accessories',label:'Day 4 — Optional upper + accessories'}]} />
                    {lastSession?.day_type && <div className="text-[10px] text-white/25 mt-1">Last session: {lastSession.day_type}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <Select label="How did it feel?" id="feel" options={[{value:'Strong — exceeded expectations',label:'Strong — exceeded expectations'},{value:'Solid — hit the targets',label:'Solid — hit the targets'},{value:'Average — got through it',label:'Average — got through it'},{value:'Weak — struggled today',label:'Weak — struggled today'},{value:'Incomplete — cut short',label:'Incomplete — cut short'}]} />
                    {lastSession?.feel && <div className="text-[10px] text-white/25 mt-1">Last session: {lastSession.feel}</div>}
                  </div>
                  <div>
                    <Input label="Overall RPE (1–10)" id="rpe" type="number" placeholder="7" min="1" max="10" step="0.5" />
                    {lastSession?.rpe && <div className="text-[10px] text-white/25 mt-1">Last session: {lastSession.rpe}/10</div>}
                  </div>
                </div>
                <div className="mb-3">
                  <Input label="Duration (min)" id="duration" type="number" placeholder="65" />
                  {lastSession?.duration && <div className="text-[10px] text-white/25 mt-1">Last session: {lastSession.duration}min</div>}
                </div>
                <Textarea label="Key lifts — weight, sets, reps, RPE per lift" id="session_detail" rows={4} placeholder="e.g. Low bar squat 4x5 @85kg RPE 6.5, felt good. RDL 3x8 @80kg RPE 6. Leg press 3x10..." />
                {lastSession?.session_detail && <div className="text-[10px] text-white/25 mt-1 mb-3">Last session: {lastSession.session_detail}</div>}
                <Textarea label="Notes — mobility, soreness, anything to flag for programming" id="session_notes" placeholder="e.g. Hips tight on warm up, loosened by set 3..." />
                <Divider />
                <Button color="blue" disabled={submitting} className="w-full">
                  {submitting ? <span className="flex items-center justify-center gap-2"><Spinner />Saving...</span> : alreadyLoggedToday ? "Update today's session" : 'Submit to strength coach'}
                </Button>
              </form>
              {result && !result.error && (
                <div className="mt-4 p-4 bg-etg-blue/10 border border-etg-blue/20 rounded-xl">
                  <div className="text-xs text-etg-blue font-medium mb-2 uppercase tracking-wider">Strength coach response</div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{result.output}</p>
                </div>
              )}
              {result?.error && <div className="mt-4 text-sm text-red-400">{result.error}</div>}
            </Card>
          )}
          {tab === 'program' && (
            <div className="space-y-4">
              <div className="bg-etg-blue/10 border border-etg-blue/20 rounded-xl p-4 mb-2">
                <div className="text-sm font-medium text-etg-blue mb-1">Week 1 — Reintroduction block</div>
                <div className="text-xs text-white/50 leading-relaxed">Goal this week is movement quality, not load. RPE 6 means 4 reps left in the tank. No conventional deadlift until week 3.</div>
              </div>
              {WEEK1_PROGRAM.map((day, i) => (
                <Card key={i} accent="blue">
                  <div className="text-sm font-medium text-white mb-3">{day.day}</div>
                  <table className="w-full text-xs">
                    <thead><tr className="text-white/30 uppercase tracking-wider"><th className="text-left pb-2 font-medium">Exercise</th><th className="text-left pb-2 font-medium">Sets</th><th className="text-left pb-2 font-medium">Reps</th><th className="text-left pb-2 font-medium">RPE</th><th className="text-left pb-2 font-medium">Notes</th></tr></thead>
                    <tbody>{day.exercises.map((ex, j) => (<tr key={j} className="border-t border-white/5"><td className="py-1.5 text-white/80">{ex.name}</td><td className="py-1.5 text-white/60">{ex.sets}</td><td className="py-1.5 text-white/60">{ex.reps}</td><td className="py-1.5 text-white/60">{ex.rpe}</td><td className="py-1.5 text-white/40">{ex.notes}</td></tr>))}</tbody>
                  </table>
                </Card>
              ))}
            </div>
          )}
          {tab === 'chat' && (
            <Card accent="blue" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8"><div className="text-xs text-white/40">Full conversation with Dr. Reid</div></div>
              <div className="flex-1 min-h-0"><ChatInterface coach="strength" initialMessages={chatHistory} /></div>
            </Card>
          )}
          {tab === 'trends' && (
            <div className="space-y-4">
              <Card><TrendChart data={rpeData} dataKey="rpe" color="#378ADD" label="Session RPE" unit="/10" /></Card>
              <Card><TrendChart data={durData} dataKey="duration" color="#185FA5" label="Session duration (min)" unit="min" /></Card>
            </div>
          )}
          {tab === 'history' && (
            <div className="space-y-3">
              {sessions.length === 0 && <div className="text-white/30 text-sm text-center py-8">No sessions logged yet.</div>}
              {[...sessions].reverse().map((s) => (
                <Card key={s.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white">{format(parseISO(s.date), 'EEEE, d MMM yyyy')}</div>
                    <div className="flex gap-2"><Badge color="blue">RPE {s.rpe}/10</Badge><Badge color="blue">{s.feel?.split('—')[0]?.trim()}</Badge></div>
                  </div>
                  <div className="text-xs text-white/50 mb-2">{s.day_type} · {s.duration}min · Week {s.week_number}</div>
                  <div className="text-xs text-white/40 mb-3 leading-relaxed">{s.session_detail}</div>
                  {s.coach_output && <div className="text-xs text-white/50 leading-relaxed border-t border-white/8 pt-2">{s.coach_output}</div>}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
