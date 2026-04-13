'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import SynthesisReport from '@/components/SynthesisReport'
import { Card, MetricCard, Badge, Tabs, Spinner } from '@/components/ui'
import { format, parseISO } from 'date-fns'

const COACH_META = {
  nutrition: { label: 'Nutrition', color: 'text-etg-green', bg: 'bg-etg-green/10', border: 'border-etg-green/20', dot: 'bg-etg-green' },
  recovery:  { label: 'Recovery', color: 'text-etg-amber', bg: 'bg-etg-amber/10', border: 'border-etg-amber/20', dot: 'bg-etg-amber' },
  strength:  { label: 'Strength', color: 'text-etg-blue',  bg: 'bg-etg-blue/10',  border: 'border-etg-blue/20',  dot: 'bg-etg-blue'  },
}

export default function CentralPage() {
  const [tab, setTab] = useState('synthesis')
  const [logs, setLogs] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [flags, setFlags] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [directives, setDirectives] = useState<any[]>([])

  const [synthesising, setSynthesising] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [reportMeta, setReportMeta] = useState<string | null>(null)
  const [synthError, setSynthError] = useState<string | null>(null)

  const [addingDirective, setAddingDirective] = useState(false)
  const [newDirectiveTarget, setNewDirectiveTarget] = useState<'nutrition' | 'recovery' | 'strength'>('nutrition')
  const [newDirectiveText, setNewDirectiveText] = useState('')
  const [newDirectivePriority, setNewDirectivePriority] = useState<'high' | 'medium'>('medium')
  const [savingDirective, setSavingDirective] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: s }, { data: f }, { data: ch }, { data: d }] = await Promise.all([
        supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(14),
        supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
        supabase.from('guardrail_flags').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('chat_messages').select('*').eq('coach', 'central').order('created_at', { ascending: true }).limit(100),
        supabase.from('coach_directives').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      setLogs((l || []).reverse())
      setSessions(s || [])
      setFlags(f || [])
      setChatHistory((ch || []).map(m => ({ role: m.role, content: m.content })))
      setDirectives(d || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleSynthesize() {
    setSynthesising(true); setSynthError(null); setReport(null)
    try {
      // cache: 'no-store' prevents any cached response from a different API route
      // being served here. Body includes ts to ensure the request is always unique.
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ ts: Date.now() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReport(data.report)
      setReportMeta(data.generatedAt)
      if (data.directives) setDirectives(data.directives)
    } catch (err: any) {
      setSynthError(err.message || 'Synthesis failed')
    } finally { setSynthesising(false) }
  }

  async function dismissDirective(id: string) {
    await supabase.from('coach_directives').update({ active: false }).eq('id', id)
    setDirectives(prev => prev.map(d => d.id === id ? { ...d, active: false } : d))
  }

  async function saveManualDirective() {
    if (!newDirectiveText.trim()) return
    setSavingDirective(true)
    const { data } = await supabase.from('coach_directives').insert({
      target_coach: newDirectiveTarget, directive: newDirectiveText.trim(),
      priority: newDirectivePriority, source: 'manual', active: true,
    }).select().single()
    if (data) setDirectives(prev => [data, ...prev])
    setNewDirectiveText(''); setAddingDirective(false); setSavingDirective(false)
  }

  async function resolveFlag(id: string) {
    await supabase.from('guardrail_flags').update({ resolved: true }).eq('id', id)
    setFlags(prev => prev.map(f => f.id === id ? { ...f, resolved: true } : f))
  }

  const unresolvedFlags = flags.filter(f => !f.resolved)
  const activeDirectives = directives.filter(d => d.active)
  const hasData = logs.some(l => l.calories || l.hrv)
  const isChat = tab === 'chat'

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center"><div className="text-white/45 text-sm">Loading...</div></main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className={`ml-52 flex-1 flex flex-col min-h-0 ${isChat ? 'overflow-hidden' : 'overflow-y-auto'}`}>

        <div className="flex-shrink-0 px-6 pt-5">
          <div className={isChat ? '' : 'max-w-5xl mx-auto'}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-etg-purple flex items-center justify-center text-sm font-bold text-white">C</div>
              <div>
                <h1 className="text-lg font-semibold text-white">Central Coach</h1>
                <p className="text-xs text-white/45">Head performance coach · Long-term pattern analysis · Goal arbiter</p>
              </div>
              {unresolvedFlags.length > 0 && <Badge color="purple">{unresolvedFlags.length} active flags</Badge>}
              {activeDirectives.length > 0 && (
                <span className="text-xs bg-etg-purple/20 text-etg-purple px-2.5 py-0.5 rounded-full font-semibold">
                  {activeDirectives.length} directive{activeDirectives.length > 1 ? 's' : ''} active
                </span>
              )}
            </div>
            {!isChat && (
              <div className="grid grid-cols-4 gap-3 mb-5">
                <MetricCard label="Nutrition logs"    value={logs.filter(l => l.calories).length} />
                <MetricCard label="Recovery logs"     value={logs.filter(l => l.hrv).length} />
                <MetricCard label="Strength sessions" value={sessions.length} />
                <MetricCard label="Active directives" value={activeDirectives.length} />
              </div>
            )}
            <Tabs
              tabs={[
                { id: 'synthesis',  label: 'Synthesis' },
                { id: 'directives', label: `Directives${activeDirectives.length ? ` (${activeDirectives.length})` : ''}` },
                { id: 'chat',       label: 'Chat' },
                { id: 'flags',      label: 'Flags' },
                { id: 'history',    label: 'History' },
              ]}
              active={tab} onChange={setTab}
            />
          </div>
        </div>

        {isChat && (
          <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col">
            <div className="flex-1 min-h-0 bg-[#111] border border-etg-purple/40 rounded-xl overflow-hidden flex flex-col">
              <div className="flex-shrink-0 px-4 py-3 border-b border-white/10 flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-etg-purple flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">C</div>
                <div className="text-sm text-white/55 flex-1">Ask about patterns, goal trajectory, cross-domain decisions — the central coach has your full history in context</div>
                {activeDirectives.length > 0 && (
                  <span className="text-xs bg-etg-purple/15 text-etg-purple/70 px-2 py-0.5 rounded-full flex-shrink-0 font-medium">
                    {activeDirectives.length} active directive{activeDirectives.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <ChatInterface coach="central" initialMessages={chatHistory} />
              </div>
            </div>
          </div>
        )}

        {!isChat && (
          <div className="flex-1 px-6 pb-6 pt-0">
            <div className="max-w-5xl mx-auto space-y-4">

              {tab === 'synthesis' && (
                <>
                  <div className="bg-gradient-to-r from-etg-purple/15 to-transparent border border-etg-purple/25 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white mb-1.5">Full performance synthesis</div>
                        <div className="text-sm text-white/55 leading-relaxed">
                          Analyses your complete history — weight trajectory, HRV patterns, nutrition consistency over weeks, strength progression — and spots cross-domain patterns individual coaches miss.
                          Also issues fresh standing directives to all three specialists.
                        </div>
                      </div>
                      <button type="button" onClick={handleSynthesize} disabled={synthesising || !hasData}
                        className="flex items-center gap-2 bg-etg-purple hover:bg-etg-purple/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all flex-shrink-0">
                        {synthesising
                          ? <><Spinner size="sm" /><span>Analysing...</span></>
                          : <><span className="text-base leading-none">⚡</span><span>Synthesize</span></>}
                      </button>
                    </div>
                    {synthesising && (
                      <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/45 flex items-center gap-2">
                        <Spinner size="sm" />
                        Reading full history, computing trends, generating cross-domain report...
                      </div>
                    )}
                    {!hasData && (
                      <div className="mt-3 pt-3 border-t border-white/8 text-xs text-white/35">
                        Log at least one day of nutrition or recovery data to run a synthesis.
                      </div>
                    )}
                  </div>

                  {synthError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{synthError}</div>
                  )}

                  {report && reportMeta && <SynthesisReport report={report} generatedAt={reportMeta} />}

                  {!report && !synthesising && !synthError && (
                    <div className="text-center py-16 text-white/30 text-sm">
                      <div className="text-4xl mb-4 opacity-30">⚡</div>
                      Hit Synthesize above — the central coach will analyse your full history, not just the last few days.
                    </div>
                  )}
                </>
              )}

              {tab === 'directives' && (
                <>
                  <div className="bg-etg-purple/8 border border-etg-purple/20 rounded-xl p-4">
                    <p className="text-sm text-white/60 leading-relaxed">
                      <span className="text-etg-purple font-semibold">Standing directives</span> are instructions the central coach issues to each specialist after a synthesis. They're injected into every log and chat — so Dr. Mitchell, Dr. Hartley and Dr. Reid always have the latest cross-domain context.
                    </p>
                  </div>

                  {(['nutrition', 'recovery', 'strength'] as const).map(coachKey => {
                    const meta = COACH_META[coachKey]
                    const cd = activeDirectives.filter(d => d.target_coach === coachKey)
                    if (!cd.length) return null
                    return (
                      <div key={coachKey} className={`border rounded-xl p-4 ${meta.border} ${meta.bg}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                          <span className={`text-xs font-bold uppercase tracking-wider ${meta.color}`}>{meta.label} coach</span>
                        </div>
                        <div className="space-y-3">
                          {cd.map(d => (
                            <div key={d.id} className="flex items-start gap-2.5 group">
                              <div className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${d.priority === 'high' ? 'bg-red-400' : 'bg-etg-amber'}`} />
                              <div className="flex-1">
                                <p className="text-sm text-white/80 leading-relaxed">{d.directive}</p>
                                <span className="text-xs text-white/35 font-medium">
                                  {d.source === 'manual' ? 'Manual' : 'From synthesis'} · {format(new Date(d.created_at), 'd MMM HH:mm')}
                                </span>
                              </div>
                              <button type="button" onClick={() => dismissDirective(d.id)}
                                className="text-white/20 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-colors px-1">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {activeDirectives.length === 0 && !addingDirective && (
                    <div className="text-center py-10 text-white/30 text-sm">No active directives. Run a synthesis to auto-generate them.</div>
                  )}

                  {addingDirective ? (
                    <div className="bg-[#111] border border-white/12 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-white/55 uppercase tracking-wider">New directive</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-white/55 block mb-1.5">Target coach</label>
                          <select value={newDirectiveTarget} onChange={e => setNewDirectiveTarget(e.target.value as any)}
                            className="bg-[#1a1a1a] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full [&>option]:bg-[#1a1a1a] [&>option]:text-white">
                            <option value="nutrition">Nutrition (Dr. Mitchell)</option>
                            <option value="recovery">Recovery (Dr. Hartley)</option>
                            <option value="strength">Strength (Dr. Reid)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-white/55 block mb-1.5">Priority</label>
                          <select value={newDirectivePriority} onChange={e => setNewDirectivePriority(e.target.value as any)}
                            className="bg-[#1a1a1a] border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full [&>option]:bg-[#1a1a1a] [&>option]:text-white">
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/55 block mb-1.5">Directive</label>
                        <textarea value={newDirectiveText} onChange={e => setNewDirectiveText(e.target.value)} rows={3}
                          placeholder="e.g. Athlete is targeting 95kg. Push back if protein is under 180g. Suggest specific food swaps."
                          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none resize-none" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAddingDirective(false)}
                          className="px-3 py-2 text-sm text-white/45 border border-white/12 rounded-lg hover:bg-white/5 font-medium">Cancel</button>
                        <button type="button" onClick={saveManualDirective} disabled={savingDirective || !newDirectiveText.trim()}
                          className="px-3 py-2 text-sm bg-etg-purple hover:bg-etg-purple/80 disabled:opacity-40 text-white rounded-lg flex items-center gap-1.5 font-semibold">
                          {savingDirective && <Spinner size="sm" />} Save directive
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAddingDirective(true)}
                      className="w-full border border-dashed border-white/12 hover:border-etg-purple/40 hover:bg-etg-purple/5 rounded-xl py-3 text-sm text-white/40 hover:text-white/60 transition-all font-medium">
                      + Add manual directive
                    </button>
                  )}

                  {directives.filter(d => !d.active).length > 0 && (
                    <details className="group">
                      <summary className="text-sm text-white/30 cursor-pointer hover:text-white/50 list-none flex items-center gap-1.5 font-medium">
                        <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                        {directives.filter(d => !d.active).length} dismissed directives
                      </summary>
                      <div className="mt-2 space-y-2 opacity-40">
                        {directives.filter(d => !d.active).map(d => (
                          <div key={d.id} className="bg-white/3 rounded-lg px-3 py-2 text-xs text-white/50">
                            <span className={`mr-1.5 font-semibold ${COACH_META[d.target_coach as keyof typeof COACH_META]?.color}`}>{d.target_coach}</span>
                            {d.directive}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}

              {tab === 'flags' && (
                <div className="space-y-3">
                  {flags.length === 0 && <div className="text-white/35 text-sm text-center py-10">No flags raised yet.</div>}
                  {flags.map(f => (
                    <Card key={f.id} className={f.resolved ? 'opacity-40' : ''}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-white/85 font-medium">{f.message}</div>
                          <div className="text-xs text-white/40 mt-1">{format(parseISO(f.created_at), 'd MMM yyyy · HH:mm')}</div>
                        </div>
                        {!f.resolved
                          ? <button type="button" onClick={() => resolveFlag(f.id)} className="text-xs text-white/40 hover:text-white/70 border border-white/12 rounded-lg px-3 py-1.5 font-medium transition-colors">Resolve</button>
                          : <span className="text-xs text-white/25 font-medium">Resolved</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {tab === 'history' && (
                <div className="space-y-3">
                  {logs.filter(l => l.central_output).length === 0 && <div className="text-white/35 text-sm text-center py-10">No history yet.</div>}
                  {[...logs].filter(l => l.central_output).reverse().map(l => (
                    <Card key={l.id}>
                      <div className="text-xs text-white/40 mb-2 font-medium">{format(parseISO(l.date), 'EEEE, d MMM yyyy')}</div>
                      <p className="text-sm text-white/65 leading-relaxed">{l.central_output}</p>
                    </Card>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

      </main>
    </div>
  )
}
