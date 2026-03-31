'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import CoachResponse from '@/components/CoachResponse'
import { Card, MetricCard, Badge, Tabs, Spinner } from '@/components/ui'
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

// Week 1 base program — can be overridden by program_overrides table
const BASE_PROGRAM: Record<string, { exercise: string; sets: string; reps: string; rpe: string; notes: string }[]> = {
  'Day 1 — Lower (squat focus)': [
    { exercise: 'Low bar back squat', sets: '4', reps: '5', rpe: '6', notes: '~80-90kg, slow descent' },
    { exercise: 'Romanian deadlift', sets: '3', reps: '8', rpe: '6', notes: 'Hinge pattern, not heavy' },
    { exercise: 'Leg press', sets: '3', reps: '10', rpe: '6', notes: 'Full range, controlled' },
    { exercise: 'Leg curl', sets: '3', reps: '10', rpe: '6', notes: '' },
    { exercise: 'Dead bug', sets: '3', reps: '10/side', rpe: '—', notes: 'Core stability' },
  ],
  'Day 2 — Upper (bench heavy)': [
    { exercise: 'Bench press', sets: '5', reps: '3', rpe: '7-8', notes: '~90-92kg, main bench day' },
    { exercise: 'Incline DB press', sets: '3', reps: '8', rpe: '7', notes: '' },
    { exercise: 'Barbell row', sets: '4', reps: '6', rpe: '7', notes: 'Horizontal pull balance' },
    { exercise: 'Face pulls', sets: '3', reps: '15', rpe: '6', notes: 'Shoulder health' },
    { exercise: 'Tricep pushdown', sets: '3', reps: '12', rpe: '6', notes: '' },
  ],
  'Day 3 — Lower (hinge + squat accessory)': [
    { exercise: 'Romanian deadlift', sets: '4', reps: '6', rpe: '6-7', notes: 'Slightly heavier than day 1' },
    { exercise: 'Goblet squat', sets: '3', reps: '8', rpe: '5', notes: 'Light, pause at bottom — mobility' },
    { exercise: 'Walking lunges', sets: '3', reps: '8/leg', rpe: '6', notes: '' },
    { exercise: 'Leg curl', sets: '3', reps: '10', rpe: '6', notes: '' },
    { exercise: 'Ab wheel / plank', sets: '3', reps: '—', rpe: '—', notes: '' },
  ],
  'Day 4 — Optional: Bench volume + accessories': [
    { exercise: 'Bench press', sets: '4', reps: '5', rpe: '6-7', notes: '~82-85kg, volume not intensity' },
    { exercise: 'Overhead press', sets: '3', reps: '8', rpe: '7', notes: '' },
    { exercise: 'Lat pulldown', sets: '3', reps: '10', rpe: '6', notes: '' },
    { exercise: 'Bicep curl', sets: '3', reps: '12', rpe: '6', notes: '' },
    { exercise: 'Tricep superset', sets: '3', reps: '12', rpe: '6', notes: '' },
  ],
}

const DAY_ORDER = [
  'Day 1 — Lower (squat focus)',
  'Day 2 — Upper (bench heavy)',
  'Day 3 — Lower (hinge + squat accessory)',
  'Day 4 — Optional: Bench volume + accessories',
]


function uniqueExerciseNames(sets: any[]): string[] {
  const seen: Record<string, boolean> = {}
  const result: string[] = []
  sets.forEach((s: any) => {
    if (!seen[s.exercise_name]) { seen[s.exercise_name] = true; result.push(s.exercise_name) }
  })
  return result
}

type SetRow = { weight: string; reps: string; rpe: string; notes: string }
type ExerciseLog = { exercise: string; sets: SetRow[] }

function emptySet(): SetRow { return { weight: '', reps: '', rpe: '', notes: '' } }

function buildExerciseLogs(dayType: string, numSets: (ex: string) => number): ExerciseLog[] {
  const exercises = BASE_PROGRAM[dayType] || []
  return exercises.map(ex => ({
    exercise: ex.exercise,
    sets: Array.from({ length: parseInt(ex.sets) || 3 }, () => emptySet()),
  }))
}

export default function StrengthPage() {
  const [tab, setTab] = useState('program')
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionSets, setSessionSets] = useState<Record<string, any[]>>({})
  const [overrides, setOverrides] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Log session state
  const [logDay, setLogDay] = useState('')
  const [logDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [logWeek, setLogWeek] = useState('1')
  const [logFeel, setLogFeel] = useState('')
  const [logDuration, setLogDuration] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [existingSession, setExistingSession] = useState<any>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sets }, { data: ov }, { data: ch }] = await Promise.all([
        supabase.from('strength_sessions').select('*').order('date', { ascending: true }),
        supabase.from('session_sets').select('*').order('set_number', { ascending: true }),
        supabase.from('program_overrides').select('*').order('created_at', { ascending: true }),
        supabase.from('chat_messages').select('*').eq('coach', 'strength').order('created_at', { ascending: true }).limit(100),
      ])
      setSessions(s || [])
      // Group sets by session_id
      const grouped: Record<string, any[]> = {}
      ;(sets || []).forEach(set => {
        if (!grouped[set.session_id]) grouped[set.session_id] = []
        grouped[set.session_id].push(set)
      })
      setSessionSets(grouped)
      setOverrides(ov || [])
      setChatHistory((ch || []).map(m => ({ role: m.role, content: m.content })))
      setLoading(false)
    }
    load()
  }, [])

  function handleDaySelect(dayType: string) {
    setLogDay(dayType)
    setExerciseLogs(buildExerciseLogs(dayType, () => 3))
    setResult(null)
    // Check if already logged today for this day
    const existing = sessions.find(s => s.date === logDate && s.day_type === dayType)
    setExistingSession(existing || null)
    setTab('log')
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof SetRow, value: string) {
    setExerciseLogs(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex,
      sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value })
    }))
  }

  function addSet(exIdx: number) {
    setExerciseLogs(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: [...ex.sets, emptySet()]
    }))
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExerciseLogs(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.filter((_, j) => j !== setIdx)
    }))
  }

  async function handleSubmit() {
    if (!logDay) return
    setSubmitting(true)
    setResult(null)

    // Build session detail string for the coach
    const detail = exerciseLogs.map(ex => {
      const setsStr = ex.sets
        .filter(s => s.weight || s.reps)
        .map((s, i) => `Set ${i + 1}: ${s.weight ? s.weight + 'kg' : '—'} × ${s.reps || '—'} reps ${s.rpe ? `@RPE${s.rpe}` : ''} ${s.notes ? `(${s.notes})` : ''}`.trim())
        .join(', ')
      return setsStr ? `${ex.exercise}: ${setsStr}` : null
    }).filter(Boolean).join('\n')

    const body = {
      date: logDate,
      week_number: parseInt(logWeek) || 1,
      day_type: logDay,
      rpe: null,
      duration: parseInt(logDuration) || null,
      feel: logFeel,
      session_detail: detail,
      session_notes: logNotes,
    }

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      // Find or create the session record to save sets
      let sessionId = data.id
      if (!sessionId) {
        const { data: sRow } = await supabase
          .from('strength_sessions')
          .select('id')
          .eq('date', logDate)
          .eq('day_type', logDay)
          .single()
        sessionId = sRow?.id
      }

      // Save individual sets
      if (sessionId) {
        // Delete existing sets for this session first
        await supabase.from('session_sets').delete().eq('session_id', sessionId)
        const setsToInsert: any[] = []
        exerciseLogs.forEach(ex => {
          ex.sets.forEach((s, i) => {
            if (s.weight || s.reps) {
              setsToInsert.push({
                session_id: sessionId,
                exercise_name: ex.exercise,
                set_number: i + 1,
                weight: parseFloat(s.weight) || null,
                reps: parseInt(s.reps) || null,
                rpe: parseFloat(s.rpe) || null,
                notes: s.notes || null,
              })
            }
          })
        })
        if (setsToInsert.length) await supabase.from('session_sets').insert(setsToInsert)
      }

      setResult(data)
      const { data: s } = await supabase.from('strength_sessions').select('*').order('date', { ascending: true })
      setSessions(s || [])
      const { data: sets } = await supabase.from('session_sets').select('*').order('set_number', { ascending: true })
      const grouped: Record<string, any[]> = {}
      ;(sets || []).forEach(set => {
        if (!grouped[set.session_id]) grouped[set.session_id] = []
        grouped[set.session_id].push(set)
      })
      setSessionSets(grouped)
    } catch (e) {
      setResult({ error: 'Submission failed. Please try again.' })
    }
    setSubmitting(false)
  }

  // Get sessions for current week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const thisWeekSessions = sessions.filter(s => {
    try { return isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }) }
    catch { return false }
  })

  const avgRpe = sessions.filter(s => s.rpe).length
    ? (sessions.filter(s => s.rpe).reduce((a, b) => a + b.rpe, 0) / sessions.filter(s => s.rpe).length).toFixed(1)
    : null
  const rpeData = sessions.filter(s => s.rpe).map(s => ({ date: format(parseISO(s.date), 'dd/MM'), rpe: s.rpe }))

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

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-etg-blue/20 flex items-center justify-center text-sm font-bold text-etg-blue">S</div>
            <div>
              <h1 className="text-lg font-semibold text-white">Strength Coach</h1>
              <p className="text-xs text-white/40">Dr. Marcus Reid · PhD Exercise Science, CSCS</p>
            </div>
            <Badge color="blue">{sessions.length} sessions logged</Badge>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Total sessions" value={sessions.length} />
            <MetricCard label="This week" value={thisWeekSessions.length} unit="sessions" />
            <MetricCard label="Avg RPE" value={avgRpe ?? '—'} unit="/10" />
            <MetricCard label="Current week" value={sessions.length ? `Week ${sessions[sessions.length-1]?.week_number || 1}` : 'Week 1'} />
          </div>

          <Tabs
            tabs={[
              { id: 'program', label: 'This week' },
              { id: 'log', label: 'Log session' },
              { id: 'coach', label: 'Coach' },
              { id: 'history', label: 'History' },
              { id: 'trends', label: 'Trends' },
            ]}
            active={tab}
            onChange={setTab}
          />

          {/* THIS WEEK TAB */}
          {tab === 'program' && (
            <div className="space-y-3">
              <div className="bg-etg-blue/10 border border-etg-blue/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-etg-blue">Week 1 — Squat reintroduction</div>
                    <div className="text-xs text-white/40 mt-0.5">Movement quality over load · RPE 6 target · No deadlift until Week 3</div>
                  </div>
                  <div className="text-xs text-white/30">{thisWeekSessions.length}/3 sessions done</div>
                </div>
              </div>

              {DAY_ORDER.map((dayType, i) => {
                const done = thisWeekSessions.find(s => s.day_type === dayType)
                const sets = done ? sessionSets[done.id] || [] : []
                const exercises = BASE_PROGRAM[dayType] || []
                const isOptional = dayType.includes('Optional')

                return (
                  <Card key={i} className={`border ${done ? 'border-etg-blue/40' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${done ? 'bg-etg-blue' : 'bg-white/15'}`} />
                        <div className="text-sm font-medium text-white">{dayType}</div>
                        {isOptional && <span className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">Optional</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {done && (
                          <div className="flex gap-1.5">
                            <span className="text-[10px] bg-etg-blue/15 text-etg-blue px-2 py-0.5 rounded-full">
                              {done.feel?.split('—')[0]?.trim()}
                            </span>
                            {done.duration && <span className="text-[10px] text-white/30">{done.duration}min</span>}
                          </div>
                        )}
                        {!done && (
                          <button
                            onClick={() => handleDaySelect(dayType)}
                            className="text-[11px] bg-etg-blue/20 text-etg-blue hover:bg-etg-blue/30 px-3 py-1 rounded-lg transition-all font-medium"
                          >
                            Log this session →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Exercise breakdown */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/25 uppercase tracking-wider text-[10px]">
                          <th className="text-left pb-1.5 font-medium">Exercise</th>
                          <th className="text-left pb-1.5 font-medium">Prescribed</th>
                          {done && <th className="text-left pb-1.5 font-medium text-etg-blue/70">Actual</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {exercises.map((ex, j) => {
                          const exSets = sets.filter(s => s.exercise_name === ex.exercise)
                          return (
                            <tr key={j} className="border-t border-white/5">
                              <td className="py-1.5 text-white/70 font-medium w-48">{ex.exercise}</td>
                              <td className="py-1.5 text-white/35">
                                {ex.sets}×{ex.reps} @RPE{ex.rpe}
                                {ex.notes && <span className="text-white/20 ml-1">· {ex.notes}</span>}
                              </td>
                              {done && (
                                <td className="py-1.5">
                                  {exSets.length > 0 ? (
                                    <div className="flex flex-col gap-0.5">
                                      {exSets.map((s, k) => (
                                        <span key={k} className="text-etg-blue/80">
                                          {s.weight ? `${s.weight}kg` : '—'} × {s.reps || '—'}
                                          {s.rpe ? ` @${s.rpe}` : ''}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-white/20 italic">not logged</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {done?.coach_output && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <CoachResponse text={done.coach_output} color="blue" />
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {/* LOG SESSION TAB */}
          {tab === 'log' && (
            <Card accent="blue">
              {/* Session header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Date</label>
                    <input type="date" value={logDate} onChange={e => setSelectedDate(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Week</label>
                    <input type="number" value={logWeek} onChange={e => setLogWeek(e.target.value)} min="1" max="6"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30 w-16" />
                  </div>
                </div>
                {submitting && <div className="text-xs text-white/40 flex items-center gap-1"><Spinner size="sm" /> Saving...</div>}
              </div>

              {/* Day selector */}
              {!logDay ? (
                <div>
                  <div className="text-xs text-white/40 mb-3">Select session to log:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {DAY_ORDER.map((d, i) => (
                      <button key={i} onClick={() => handleDaySelect(d)}
                        className="text-left p-3 bg-white/5 hover:bg-etg-blue/10 border border-white/10 hover:border-etg-blue/30 rounded-xl transition-all">
                        <div className="text-xs font-medium text-white">{d.split('—')[0].trim()}</div>
                        <div className="text-[10px] text-white/30 mt-0.5">{d.split('—')[1]?.trim()}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-medium text-white">{logDay}</div>
                      <button onClick={() => { setLogDay(''); setExerciseLogs([]) }} className="text-[10px] text-white/30 hover:text-white/50 mt-0.5">← Change session</button>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/40">Feel</label>
                        <select value={logFeel} onChange={e => setLogFeel(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                          <option value="">Select...</option>
                          <option value="Strong — exceeded expectations">Strong</option>
                          <option value="Solid — hit the targets">Solid</option>
                          <option value="Average — got through it">Average</option>
                          <option value="Weak — struggled today">Weak</option>
                          <option value="Incomplete — cut short">Incomplete</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/40">Duration (min)</label>
                        <input type="number" value={logDuration} onChange={e => setLogDuration(e.target.value)} placeholder="65"
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none w-20" />
                      </div>
                    </div>
                  </div>

                  {/* Exercise-by-exercise logging */}
                  <div className="space-y-4">
                    {exerciseLogs.map((ex, exIdx) => {
                      const prescribed = BASE_PROGRAM[logDay]?.find(p => p.exercise === ex.exercise)
                      return (
                        <div key={exIdx} className="bg-white/3 border border-white/8 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-xs font-medium text-white">{ex.exercise}</div>
                              {prescribed && (
                                <div className="text-[10px] text-white/25 mt-0.5">
                                  Prescribed: {prescribed.sets}×{prescribed.reps} @RPE{prescribed.rpe}
                                  {prescribed.notes ? ` · ${prescribed.notes}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {/* Header */}
                            <div className="grid grid-cols-12 gap-1.5 text-[9px] text-white/25 uppercase tracking-wider px-1">
                              <div className="col-span-1">Set</div>
                              <div className="col-span-3">Weight (kg)</div>
                              <div className="col-span-3">Reps</div>
                              <div className="col-span-3">RPE</div>
                              <div className="col-span-2">Notes</div>
                            </div>
                            {ex.sets.map((s, setIdx) => (
                              <div key={setIdx} className="grid grid-cols-12 gap-1.5 items-center">
                                <div className="col-span-1 text-[10px] text-white/30 text-center">{setIdx + 1}</div>
                                <input
                                  value={s.weight} onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                                  placeholder="kg" type="number" step="0.5"
                                  className="col-span-3 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-etg-blue/40"
                                />
                                <input
                                  value={s.reps} onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                                  placeholder="reps" type="number"
                                  className="col-span-3 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-etg-blue/40"
                                />
                                <input
                                  value={s.rpe} onChange={e => updateSet(exIdx, setIdx, 'rpe', e.target.value)}
                                  placeholder="RPE" type="number" step="0.5" min="1" max="10"
                                  className="col-span-3 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-etg-blue/40"
                                />
                                <button onClick={() => removeSet(exIdx, setIdx)}
                                  className="col-span-2 text-white/15 hover:text-red-400 text-xs transition-colors text-center">✕</button>
                              </div>
                            ))}
                            <button onClick={() => addSet(exIdx)}
                              className="text-[10px] text-etg-blue/50 hover:text-etg-blue transition-colors mt-1 flex items-center gap-1">
                              <span>+</span> Add set
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Session notes */}
                  <div className="mt-4">
                    <label className="text-xs text-white/40 block mb-1.5">Session notes — mobility, soreness, flags for programming</label>
                    <textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={2}
                      placeholder="e.g. Hips tight on warm up, loosened by set 3. Bench felt strong..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/15 focus:outline-none focus:border-white/30 resize-none" />
                  </div>

                  <div className="mt-4">
                    <button onClick={handleSubmit} disabled={submitting}
                      className="w-full bg-etg-blue hover:bg-etg-blue/80 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                      {submitting ? <><Spinner />Saving...</> : 'Submit to strength coach'}
                    </button>
                  </div>

                  {result && !result.error && <CoachResponse text={result.output} color="blue" />}
                  {result?.error && <div className="mt-4 text-sm text-red-400">{result.error}</div>}
                </div>
              )}
            </Card>
          )}

          {/* COACH TAB */}
          {tab === 'coach' && (
            <div className="space-y-3">
              <div className="bg-etg-blue/10 border border-etg-blue/20 rounded-xl p-3">
                <div className="text-xs text-white/50 leading-relaxed">
                  Dr. Reid has full visibility of your program, all logged sessions with exercise-by-exercise data, and your training history.
                  Ask about load progression, technique, programming adjustments, or anything training-related.
                  He can prescribe changes to next week&apos;s sessions directly in the conversation.
                </div>
              </div>
              <Card accent="blue" className="h-[600px] flex flex-col p-0 overflow-hidden">
                <div className="p-3 border-b border-white/8 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-etg-blue/20 flex items-center justify-center text-[9px] font-bold text-etg-blue">S</div>
                  <div className="text-xs text-white/40">Dr. Marcus Reid · Strength coach & programmer</div>
                </div>
                <div className="flex-1 min-h-0">
                  <ChatInterface coach="strength" initialMessages={chatHistory} />
                </div>
              </Card>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-3">
              {sessions.length === 0 && <div className="text-white/30 text-sm text-center py-8">No sessions logged yet.</div>}
              {[...sessions].reverse().map((s) => {
                const sets = sessionSets[s.id] || []
                const exerciseNames = uniqueExerciseNames(sets)
                return (
                  <Card key={s.id}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-medium text-white">{format(parseISO(s.date), 'EEEE, d MMM yyyy')}</div>
                        <div className="text-xs text-white/40 mt-0.5">{s.day_type} · Week {s.week_number}{s.duration ? ` · ${s.duration}min` : ''}</div>
                      </div>
                      <div className="flex gap-1.5">
                        {s.feel && <Badge color="blue">{s.feel.split('—')[0]?.trim()}</Badge>}
                      </div>
                    </div>

                    {/* Set data */}
                    {exerciseNames.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {exerciseNames.map(exName => {
                          const exSets = sets.filter(s => s.exercise_name === exName)
                          return (
                            <div key={exName} className="bg-white/3 rounded-lg p-2.5">
                              <div className="text-xs font-medium text-white/70 mb-1.5">{exName}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {exSets.map((s, i) => (
                                  <div key={i} className="text-[10px] bg-etg-blue/10 text-etg-blue/80 px-2 py-0.5 rounded-md">
                                    {s.weight ? `${s.weight}kg` : '—'} × {s.reps || '—'}{s.rpe ? ` @${s.rpe}` : ''}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : s.session_detail ? (
                      <div className="text-xs text-white/40 mb-3 leading-relaxed">{s.session_detail}</div>
                    ) : null}

                    {s.coach_output && <CoachResponse text={s.coach_output} color="blue" />}
                  </Card>
                )
              })}
            </div>
          )}

          {/* TRENDS TAB */}
          {tab === 'trends' && (
            <div className="space-y-4">
              <Card>
                <TrendChart data={rpeData} dataKey="rpe" color="#378ADD" label="Session RPE" unit="/10" />
              </Card>
              {/* Per-exercise trend: squat and bench */}
              {['Low bar back squat', 'Bench press'].map(exName => {
                const data = sessions.map(s => {
                  const sets = (sessionSets[s.id] || []).filter(st => st.exercise_name === exName && st.weight)
                  if (!sets.length) return null
                  const maxWeight = Math.max(...sets.map(s => s.weight))
                  return { date: format(parseISO(s.date), 'dd/MM'), weight: maxWeight }
                }).filter(Boolean) as { date: string; weight: number }[]

                if (!data.length) return null
                return (
                  <Card key={exName}>
                    <TrendChart data={data} dataKey="weight" color="#378ADD" label={`${exName} — top weight (kg)`} unit="kg" />
                  </Card>
                )
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
