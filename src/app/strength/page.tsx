'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import CoachResponse from '@/components/CoachResponse'
import { Card, MetricCard, Badge, Tabs, Spinner } from '@/components/ui'
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

type Exercise = { name: string; sets: number; reps: string; rpe: string; load_notes: string; technique_notes: string }
type Session = { id: string; name: string; order: number; optional: boolean; exercises: Exercise[] }
type Program = { id: string; block_name: string; week_number: number; total_weeks: number; goal: string; coach_notes: string; sessions: Session[]; updated_at: string }
type SetRow = { weight: string; reps: string; rpe: string; notes: string }
type ExerciseLog = { exercise: string; sets: SetRow[] }

function emptySet(): SetRow { return { weight: '', reps: '', rpe: '', notes: '' } }

function uniqueExerciseNames(sets: any[]): string[] {
  const seen: Record<string, boolean> = {}
  const result: string[] = []
  sets.forEach(s => { if (!seen[s.exercise_name]) { seen[s.exercise_name] = true; result.push(s.exercise_name) } })
  return result
}

function buildExerciseLogs(session: Session): ExerciseLog[] {
  return session.exercises.map(ex => ({
    exercise: ex.name,
    sets: Array.from({ length: ex.sets || 3 }, () => emptySet()),
  }))
}

// Inline chat component that supports programUpdated notifications
function StrengthChatInterface({ initialMessages, onProgramUpdated }: { initialMessages: any[]; onProgramUpdated: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [programUpdatedToast, setProgramUpdatedToast] = useState(false)

  async function send() {
    if (!input.trim() || sending) return
    const userMsg = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach: 'strength', messages: newMessages }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (data.programUpdated) {
        setProgramUpdatedToast(true)
        onProgramUpdated()
        setTimeout(() => setProgramUpdatedToast(false), 4000)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error — please try again.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {programUpdatedToast && (
        <div className="flex-shrink-0 mx-4 mt-3 bg-etg-blue/20 border border-etg-blue/30 rounded-lg px-3 py-2 text-xs text-etg-blue flex items-center gap-2">
          <span>✓</span> Dr. Reid updated your program — refresh "This week" to see changes
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <div className="text-white/20 text-xs">Dr. Reid has full context: your program, all session data, recovery trends, and central coach directives.</div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                'Review my program and suggest improvements for next week',
                'I want to add a deadlift variation — what makes sense at this stage?',
                'My recovery has been poor — adjust volume accordingly',
                'Progress the squat load based on my last 3 sessions',
              ].map(prompt => (
                <button key={prompt} onClick={() => setInput(prompt)}
                  className="text-left text-[11px] text-white/40 hover:text-white/60 bg-white/3 hover:bg-white/5 border border-white/8 rounded-lg p-2.5 transition-all leading-relaxed">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'gap-2.5 items-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-etg-blue/20 flex items-center justify-center text-[9px] font-bold text-etg-blue flex-shrink-0 mt-0.5">S</div>
            )}
            <div className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] ${m.role === 'user' ? 'bg-white/8 text-white/90' : 'bg-white/5 border border-white/8 text-white/80'}`}>
              <CoachResponse text={m.content} color="blue" />
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2.5 items-start">
            <div className="w-6 h-6 rounded-full bg-etg-blue/20 flex items-center justify-center text-[9px] font-bold text-etg-blue flex-shrink-0">S</div>
            <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
            </div>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 p-3 border-t border-white/8">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask Dr. Reid to adjust the program, progress load, swap exercises..."
            rows={2}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-etg-blue/40 resize-none"
          />
          <button onClick={send} disabled={sending || !input.trim()}
            className="bg-etg-blue hover:bg-etg-blue/80 disabled:opacity-30 text-white px-4 rounded-xl transition-all flex-shrink-0">
            {sending ? <Spinner size="sm" /> : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StrengthPage() {
  const [tab, setTab] = useState('program')
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionSets, setSessionSets] = useState<Record<string, any[]>>({})
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [program, setProgram] = useState<Program | null>(null)
  const [loading, setLoading] = useState(true)

  // Log session state
  const [logSession, setLogSession] = useState<Session | null>(null)
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [logWeek, setLogWeek] = useState('1')
  const [logFeel, setLogFeel] = useState('')
  const [logDuration, setLogDuration] = useState('')
  const [logNotes, setLogNotes] = useState('')
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  async function loadData() {
    const [{ data: s }, { data: sets }, { data: ch }, programRes] = await Promise.all([
      supabase.from('strength_sessions').select('*').order('date', { ascending: true }),
      supabase.from('session_sets').select('*').order('set_number', { ascending: true }),
      supabase.from('chat_messages').select('*').eq('coach', 'strength').order('created_at', { ascending: true }).limit(100),
      fetch('/api/program').then(r => r.json()),
    ])
    setSessions(s || [])
    const grouped: Record<string, any[]> = {}
    ;(sets || []).forEach((set: any) => {
      if (!grouped[set.session_id]) grouped[set.session_id] = []
      grouped[set.session_id].push(set)
    })
    setSessionSets(grouped)
    setChatHistory((ch || []).map((m: any) => ({ role: m.role, content: m.content })))
    if (programRes.program) {
      const p = programRes.program
      const parsedSessions: Session[] = typeof p.sessions === 'string' ? JSON.parse(p.sessions) : p.sessions
      setProgram({ ...p, sessions: parsedSessions })
      setLogWeek(String(p.week_number || 1))
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Called when chat detects a program update
  const handleProgramUpdated = useCallback(async () => {
    const res = await fetch('/api/program')
    const data = await res.json()
    if (data.program) {
      const p = data.program
      const parsedSessions: Session[] = typeof p.sessions === 'string' ? JSON.parse(p.sessions) : p.sessions
      setProgram({ ...p, sessions: parsedSessions })
    }
  }, [])

  function handleSessionSelect(session: Session) {
    setLogSession(session)
    setExerciseLogs(buildExerciseLogs(session))
    setResult(null)
    setTab('log')
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof SetRow, value: string) {
    setExerciseLogs(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value })
    }))
  }
  function addSet(exIdx: number) {
    setExerciseLogs(prev => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: [...ex.sets, emptySet()] }))
  }
  function removeSet(exIdx: number, setIdx: number) {
    setExerciseLogs(prev => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }))
  }

  async function handleSubmit() {
    if (!logSession) return
    setSubmitting(true); setResult(null)
    const detail = exerciseLogs.map(ex => {
      const setsStr = ex.sets.filter(s => s.weight || s.reps)
        .map((s, i) => `Set ${i+1}: ${s.weight ? s.weight+'kg' : '—'} × ${s.reps || '—'} reps${s.rpe ? ` @RPE${s.rpe}` : ''}${s.notes ? ` (${s.notes})` : ''}`.trim())
        .join(', ')
      return setsStr ? `${ex.exercise}: ${setsStr}` : null
    }).filter(Boolean).join('\n')

    const body = {
      date: logDate, week_number: parseInt(logWeek) || 1,
      day_type: logSession.name, rpe: null,
      duration: parseInt(logDuration) || null,
      feel: logFeel, session_detail: detail, session_notes: logNotes,
    }
    try {
      const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      let sessionId = data.id
      if (!sessionId) {
        const { data: sRow } = await supabase.from('strength_sessions').select('id').eq('date', logDate).eq('day_type', logSession.name).single()
        sessionId = sRow?.id
      }
      if (sessionId) {
        await supabase.from('session_sets').delete().eq('session_id', sessionId)
        const setsToInsert: any[] = []
        exerciseLogs.forEach(ex => {
          ex.sets.forEach((s, i) => {
            if (s.weight || s.reps) setsToInsert.push({
              session_id: sessionId, exercise_name: ex.exercise, set_number: i+1,
              weight: parseFloat(s.weight) || null, reps: parseInt(s.reps) || null,
              rpe: parseFloat(s.rpe) || null, notes: s.notes || null,
            })
          })
        })
        if (setsToInsert.length) await supabase.from('session_sets').insert(setsToInsert)
      }
      setResult(data)
      await loadData()
    } catch { setResult({ error: 'Submission failed. Please try again.' }) }
    setSubmitting(false)
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const thisWeekSessions = sessions.filter(s => {
    try { return isWithinInterval(parseISO(s.date), { start: weekStart, end: weekEnd }) } catch { return false }
  })
  const rpeData = sessions.filter(s => s.rpe).map(s => ({ date: format(parseISO(s.date), 'dd/MM'), rpe: s.rpe }))

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center"><div className="text-white/30 text-sm">Loading...</div></main>
    </div>
  )

  const programSessions = program?.sessions || []

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">

          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-etg-blue/20 flex items-center justify-center text-sm font-bold text-etg-blue">S</div>
            <div>
              <h1 className="text-lg font-semibold text-white">Strength Coach</h1>
              <p className="text-xs text-white/40">Dr. Marcus Reid · PhD Exercise Science, CSCS</p>
            </div>
            <Badge color="blue">{sessions.length} sessions logged</Badge>
            {program && (
              <span className="text-[10px] bg-etg-blue/10 text-etg-blue/70 border border-etg-blue/20 px-2 py-0.5 rounded-full">
                {program.block_name} · Week {program.week_number}/{program.total_weeks}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Total sessions" value={sessions.length} />
            <MetricCard label="This week" value={thisWeekSessions.length} unit="sessions" />
            <MetricCard label="Current week" value={program ? `Week ${program.week_number}` : 'Week 1'} />
            <MetricCard label="Block weeks" value={program ? `${program.week_number}/${program.total_weeks}` : '—'} />
          </div>

          <Tabs
            tabs={[
              { id: 'program', label: 'This week' },
              { id: 'log', label: 'Log session' },
              { id: 'coach', label: 'Coach' },
              { id: 'history', label: 'History' },
              { id: 'trends', label: 'Trends' },
            ]}
            active={tab} onChange={setTab}
          />

          {/* THIS WEEK TAB */}
          {tab === 'program' && (
            <div className="space-y-3">

              {/* Block header + week progress */}
              {program ? (
                <div className="bg-[#111] border border-etg-blue/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{program.block_name}</div>
                      <div className="text-xs text-white/40 mt-0.5">{program.goal}</div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="text-xs font-medium text-etg-blue">Week {program.week_number} <span className="text-white/30 font-normal">of {program.total_weeks}</span></div>
                      <div className="text-[10px] text-white/25 mt-0.5">{thisWeekSessions.length}/{programSessions.filter(s => !s.optional).length} sessions done this week</div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: program.total_weeks }).map((_, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < program.week_number - 1 ? 'bg-etg-blue' : i === program.week_number - 1 ? 'bg-etg-blue/50' : 'bg-white/10'}`} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white/3 border border-white/10 rounded-xl p-4 text-center text-white/30 text-sm">
                  No program loaded. Run the SQL migration first.
                </div>
              )}

              {/* Session cards */}
              {programSessions.sort((a, b) => a.order - b.order).map((session) => {
                const done = thisWeekSessions.find(s => s.day_type === session.name)
                const sets = done ? sessionSets[done.id] || [] : []

                return (
                  <div key={session.id} className={`rounded-xl border overflow-hidden ${done ? 'border-etg-blue/30' : 'border-white/8'}`}>

                    {/* Session header row */}
                    <div className={`flex items-center justify-between px-4 py-3 ${done ? 'bg-etg-blue/8' : 'bg-white/3'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {done ? (
                          <div className="w-5 h-5 rounded-full bg-etg-blue flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-white/20 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold ${done ? 'text-white' : 'text-white/80'}`}>{session.name}</div>
                          {done && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-white/30">{format(parseISO(done.date), 'd MMM')}</span>
                              {done.feel && <span className="text-[10px] text-etg-blue/70">{done.feel.split('—')[0]?.trim()}</span>}
                              {done.duration && <span className="text-[10px] text-white/25">{done.duration}min</span>}
                            </div>
                          )}
                        </div>
                        {session.optional && <span className="text-[10px] text-white/25 border border-white/10 rounded px-1.5 py-0.5 ml-1 flex-shrink-0">optional</span>}
                      </div>
                      {!done && (
                        <button onClick={() => handleSessionSelect(session)}
                          className="text-[11px] bg-etg-blue/20 hover:bg-etg-blue/30 text-etg-blue px-3 py-1.5 rounded-lg font-medium transition-all flex-shrink-0 ml-3">
                          Log session →
                        </button>
                      )}
                    </div>

                    {/* Column headers */}
                    <div className="flex gap-4 px-4 pt-2.5 pb-1">
                      <div className="w-44 flex-shrink-0 text-[9px] text-white/45 uppercase tracking-wider font-semibold">Exercise</div>
                      <div className="flex-1 text-[9px] text-white/45 uppercase tracking-wider font-semibold">Prescribed</div>
                      {done && <div className="w-48 flex-shrink-0 text-[9px] text-etg-blue/70 uppercase tracking-wider font-semibold">Actual</div>}
                    </div>

                    {/* Exercise rows */}
                    <div className="divide-y divide-white/8 pb-1">
                      {session.exercises.map((ex, j) => {
                        const exSets = sets.filter((s: any) => s.exercise_name === ex.name)
                        return (
                          <div key={j} className="flex items-start gap-4 px-4 py-2">
                            <div className="w-44 flex-shrink-0">
                              <div className="text-sm font-semibold text-white">{ex.name}</div>
                              {ex.technique_notes && <div className="text-[10px] text-white/40 mt-0.5 truncate" title={ex.technique_notes}>{ex.technique_notes}</div>}
                            </div>
                            <div className="flex-1 flex items-center gap-1.5 pt-0.5 flex-wrap">
                              <span className="text-sm font-bold text-white/80">{ex.sets}×{ex.reps}</span>
                              <span className="text-xs text-etg-blue/70 font-medium">@RPE {ex.rpe}</span>
                              {ex.load_notes && <span className="text-[10px] text-white/40">· {ex.load_notes}</span>}
                            </div>
                            {done && (
                              <div className="w-48 flex-shrink-0 pt-0.5">
                                {exSets.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {exSets.map((s: any, k: number) => (
                                      <span key={k} className="text-[10px] bg-etg-blue/15 text-etg-blue border border-etg-blue/30 px-1.5 py-0.5 rounded font-medium">
                                        {s.weight ? `${s.weight}kg` : '—'}×{s.reps || '—'}{s.rpe ? ` @${s.rpe}` : ''}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-white/30">—</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Session notes footer */}
                    {done?.session_notes && (
                      <div className="px-4 py-2.5 border-t border-white/5 bg-black/15">
                        <span className="text-[10px] text-white/50 font-semibold">Notes · </span>
                        <span className="text-[10px] text-white/40">{done.session_notes}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* LOG SESSION TAB */}
          {tab === 'log' && (
            <Card accent="blue">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Date</label>
                    <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Week</label>
                    <input type="number" value={logWeek} onChange={e => setLogWeek(e.target.value)} min="1" max="12"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30 w-16" />
                  </div>
                </div>
                {submitting && <div className="text-xs text-white/40 flex items-center gap-1"><Spinner size="sm" /> Saving...</div>}
              </div>

              {!logSession ? (
                <div>
                  <div className="text-xs text-white/40 mb-3">Select session to log:</div>
                  {programSessions.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {programSessions.sort((a, b) => a.order - b.order).map(session => (
                        <button key={session.id} onClick={() => handleSessionSelect(session)}
                          className="text-left p-3 bg-white/5 hover:bg-etg-blue/10 border border-white/10 hover:border-etg-blue/30 rounded-xl transition-all">
                          <div className="text-xs font-medium text-white flex items-center gap-1.5">
                            {session.name}
                            {session.optional && <span className="text-[10px] text-white/30 border border-white/10 rounded px-1 py-0.5">opt</span>}
                          </div>
                          <div className="text-[10px] text-white/30 mt-1">{session.exercises.length} exercises</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-white/30 text-xs">Program not loaded — run the SQL migration first.</div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-medium text-white">{logSession.name}</div>
                      <button onClick={() => { setLogSession(null); setExerciseLogs([]) }} className="text-[10px] text-white/30 hover:text-white/50 mt-0.5">← Change session</button>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-white/40">Feel</label>
                        <select value={logFeel} onChange={e => setLogFeel(e.target.value)}
                          className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none [&>option]:bg-[#1a1a1a] [&>option]:text-white">
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

                  <div className="space-y-4">
                    {exerciseLogs.map((ex, exIdx) => {
                      const prescribed = logSession.exercises.find(p => p.name === ex.exercise)
                      return (
                        <div key={exIdx} className="bg-white/3 border border-white/8 rounded-xl p-3">
                          <div className="mb-2">
                            <div className="text-xs font-medium text-white">{ex.exercise}</div>
                            {prescribed && (
                              <div className="text-[10px] text-white/25 mt-0.5">
                                Prescribed: {prescribed.sets}×{prescribed.reps} @RPE{prescribed.rpe}
                                {prescribed.load_notes ? ` · ${prescribed.load_notes}` : ''}
                              </div>
                            )}
                            {prescribed?.technique_notes && (
                              <div className="text-[10px] text-etg-blue/40 mt-0.5">↳ {prescribed.technique_notes}</div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-12 gap-1.5 text-[9px] text-white/25 uppercase tracking-wider px-1">
                              <div className="col-span-1">Set</div>
                              <div className="col-span-3">Weight (kg)</div>
                              <div className="col-span-3">Reps</div>
                              <div className="col-span-3">RPE</div>
                              <div className="col-span-2"></div>
                            </div>
                            {ex.sets.map((s, setIdx) => (
                              <div key={setIdx} className="grid grid-cols-12 gap-1.5 items-center">
                                <div className="col-span-1 text-[10px] text-white/30 text-center">{setIdx+1}</div>
                                <input value={s.weight} onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                                  placeholder="kg" type="number" step="0.5"
                                  className="col-span-3 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-etg-blue/40" />
                                <input value={s.reps} onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                                  placeholder="reps" type="number"
                                  className="col-span-3 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-etg-blue/40" />
                                <input value={s.rpe} onChange={e => updateSet(exIdx, setIdx, 'rpe', e.target.value)}
                                  placeholder="RPE" type="number" step="0.5" min="1" max="10"
                                  className="col-span-3 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder-white/15 focus:outline-none focus:border-etg-blue/40" />
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

                  <div className="mt-4">
                    <label className="text-xs text-white/40 block mb-1.5">Session notes — mobility, soreness, anything for Dr. Reid</label>
                    <textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={2}
                      placeholder="e.g. Hips tight on warm up, bench felt strong, left shoulder slightly off..."
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
              <div className="bg-etg-blue/8 border border-etg-blue/20 rounded-xl p-3.5">
                <div className="text-xs text-white/50 leading-relaxed">
                  Dr. Reid sees your full program, all session data with per-set detail, recent recovery metrics, and central coach directives.
                  <span className="text-etg-blue/60"> Ask him to modify any part of the program</span> — he'll update it directly and the changes appear in "This week" immediately.
                  He searches current exercise science literature when recommending changes.
                </div>
              </div>
              <Card accent="blue" className="h-[620px] flex flex-col p-0 overflow-hidden">
                <div className="flex-shrink-0 p-3 border-b border-white/8 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-etg-blue/20 flex items-center justify-center text-[9px] font-bold text-etg-blue">S</div>
                  <div className="text-xs text-white/40 flex-1">Dr. Marcus Reid · Strength coach & programmer</div>
                  {program && (
                    <span className="text-[10px] text-etg-blue/40 flex-shrink-0">
                      {program.block_name} · Wk {program.week_number}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  <StrengthChatInterface initialMessages={chatHistory} onProgramUpdated={handleProgramUpdated} />
                </div>
              </Card>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-3">
              {sessions.length === 0 && <div className="text-white/30 text-sm text-center py-8">No sessions logged yet.</div>}
              {[...sessions].reverse().map(s => {
                const sets = sessionSets[s.id] || []
                const exerciseNames = uniqueExerciseNames(sets)
                return (
                  <Card key={s.id}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-sm font-medium text-white">{format(parseISO(s.date), 'EEEE, d MMM yyyy')}</div>
                        <div className="text-xs text-white/40 mt-0.5">{s.day_type} · Week {s.week_number}{s.duration ? ` · ${s.duration}min` : ''}</div>
                      </div>
                      {s.feel && <Badge color="blue">{s.feel.split('—')[0]?.trim()}</Badge>}
                    </div>
                    {exerciseNames.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {exerciseNames.map(exName => {
                          const exSets = sets.filter((st: any) => st.exercise_name === exName)
                          return (
                            <div key={exName} className="bg-white/3 rounded-lg p-2.5">
                              <div className="text-xs font-medium text-white/70 mb-1.5">{exName}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {exSets.map((st: any, i: number) => (
                                  <div key={i} className="text-[10px] bg-etg-blue/10 text-etg-blue/80 px-2 py-0.5 rounded-md">
                                    {st.weight ? `${st.weight}kg` : '—'} × {st.reps || '—'}{st.rpe ? ` @${st.rpe}` : ''}
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
              {rpeData.length > 0 && (
                <Card><TrendChart data={rpeData} dataKey="rpe" color="#378ADD" label="Session RPE" unit="/10" /></Card>
              )}
              {['Low bar back squat', 'Bench press'].map(exName => {
                const data = sessions.map(s => {
                  const sets = (sessionSets[s.id] || []).filter((st: any) => st.exercise_name === exName && st.weight)
                  if (!sets.length) return null
                  return { date: format(parseISO(s.date), 'dd/MM'), weight: Math.max(...sets.map((st: any) => st.weight)) }
                }).filter(Boolean) as { date: string; weight: number }[]
                if (!data.length) return null
                return <Card key={exName}><TrendChart data={data} dataKey="weight" color="#378ADD" label={`${exName} — top weight (kg)`} unit="kg" /></Card>
              })}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
