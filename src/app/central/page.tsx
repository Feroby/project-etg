'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import SynthesisReport from '@/components/SynthesisReport'
import { Card, MetricCard, Badge, Tabs, Spinner } from '@/components/ui'
import { format, parseISO } from 'date-fns'

export default function CentralPage() {
  const [tab, setTab] = useState('synthesis')
  const [logs, setLogs] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [flags, setFlags] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Synthesis state
  const [synthesising, setSynthesising] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [reportMeta, setReportMeta] = useState<string | null>(null)
  const [synthError, setSynthError] = useState<string | null>(null)
  const [dayRange, setDayRange] = useState(3)

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: s }, { data: f }, { data: ch }] = await Promise.all([
        supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(14),
        supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
        supabase.from('guardrail_flags').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('chat_messages').select('*').eq('coach', 'central').order('created_at', { ascending: true }).limit(100),
      ])
      setLogs((l || []).reverse())
      setSessions(s || [])
      setFlags(f || [])
      setChatHistory((ch || []).map(m => ({ role: m.role, content: m.content })))
      setLoading(false)
    }
    load()
  }, [])

  async function handleSynthesize() {
    setSynthesising(true)
    setSynthError(null)
    setReport(null)
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: dayRange }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReport(data.report)
      setReportMeta(data.generatedAt)
    } catch (err: any) {
      setSynthError(err.message || 'Synthesis failed — please try again')
    } finally {
      setSynthesising(false)
    }
  }

  async function resolveFlag(id: string) {
    await supabase.from('guardrail_flags').update({ resolved: true }).eq('id', id)
    setFlags(prev => prev.map(f => f.id === id ? { ...f, resolved: true } : f))
  }

  const unresolvedFlags = flags.filter(f => !f.resolved)
  const hasData = logs.some(l => l.calories || l.hrv)

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
            <div className="w-8 h-8 rounded-full bg-etg-purple flex items-center justify-center text-sm font-bold text-white">C</div>
            <div>
              <h1 className="text-lg font-semibold text-white">Central Coach</h1>
              <p className="text-xs text-white/40">Head performance coach · Cross-domain synthesis · Goal arbiter</p>
            </div>
            {unresolvedFlags.length > 0 && <Badge color="purple">{unresolvedFlags.length} active flags</Badge>}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Nutrition logs" value={logs.filter(l => l.calories).length} />
            <MetricCard label="Recovery logs" value={logs.filter(l => l.hrv).length} />
            <MetricCard label="Strength sessions" value={sessions.length} />
            <MetricCard label="Active flags" value={unresolvedFlags.length} />
          </div>

          <Tabs
            tabs={[{ id: 'synthesis', label: 'Synthesis' }, { id: 'chat', label: 'Chat' }, { id: 'flags', label: 'Flags' }, { id: 'history', label: 'History' }]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'synthesis' && (
            <div className="space-y-4">

              {/* Synthesize trigger card */}
              <div className="bg-gradient-to-r from-etg-purple/15 to-transparent border border-etg-purple/25 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white mb-1">Generate performance report</div>
                    <div className="text-xs text-white/40 leading-relaxed">
                      Reads all nutrition, recovery and strength data and produces a structured cross-domain analysis with scores, insights and actionable directives.
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-white/30 uppercase tracking-wider">Days</label>
                      <div className="flex gap-1">
                        {[1, 2, 3].map(d => (
                          <button key={d} onClick={() => setDayRange(d)}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${dayRange === d ? 'bg-etg-purple text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'}`}>
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleSynthesize}
                      disabled={synthesising || !hasData}
                      className="flex items-center gap-2 bg-etg-purple hover:bg-etg-purple/80 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
                    >
                      {synthesising ? (
                        <><Spinner size="sm" /><span>Synthesising...</span></>
                      ) : (
                        <><span className="text-base leading-none">⚡</span><span>Synthesize</span></>
                      )}
                    </button>
                  </div>
                </div>
                {!hasData && (
                  <div className="mt-3 pt-3 border-t border-white/8 text-xs text-white/30">
                    Log at least one day of nutrition or recovery data to run a synthesis.
                  </div>
                )}
                {synthesising && (
                  <div className="mt-3 pt-3 border-t border-white/8">
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Spinner size="sm" />
                      Reading {dayRange} day{dayRange > 1 ? 's' : ''} of data and generating cross-domain report...
                    </div>
                  </div>
                )}
              </div>

              {synthError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                  {synthError}
                </div>
              )}

              {/* Report output */}
              {report && reportMeta && (
                <SynthesisReport report={report} generatedAt={reportMeta} />
              )}

              {/* Fallback: show last saved central output if no report generated yet */}
              {!report && !synthesising && !synthError && (
                <div className="space-y-3">
                  {logs.filter(l => l.central_output).slice(-3).reverse().map(l => (
                    <Card key={l.id} className="border border-etg-purple/15">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] text-etg-purple/60 font-semibold uppercase tracking-wider">Previous synthesis</div>
                        <div className="text-[10px] text-white/25">{format(parseISO(l.date), 'd MMM yyyy')}</div>
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">{l.central_output}</p>
                    </Card>
                  ))}
                  {logs.filter(l => l.central_output).length === 0 && (
                    <div className="text-center py-12 text-white/20 text-sm">
                      Hit Synthesize above to generate your first report.
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {tab === 'chat' && (
            <Card accent="purple" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8">
                <div className="text-xs text-white/40">Ask the central coach about patterns, goal progress, cross-domain decisions — highest-level view of your performance</div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatInterface coach="central" initialMessages={chatHistory} />
              </div>
            </Card>
          )}

          {tab === 'flags' && (
            <div className="space-y-3">
              {flags.length === 0 && <div className="text-white/30 text-sm text-center py-8">No flags raised yet.</div>}
              {flags.map(f => (
                <Card key={f.id} className={f.resolved ? 'opacity-40' : ''}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/80">{f.message}</div>
                      <div className="text-xs text-white/30 mt-1">{format(parseISO(f.created_at), 'd MMM yyyy · HH:mm')}</div>
                    </div>
                    {!f.resolved ? (
                      <button onClick={() => resolveFlag(f.id)}
                        className="text-xs text-white/30 hover:text-white/60 flex-shrink-0 border border-white/10 rounded px-2 py-1">
                        Resolve
                      </button>
                    ) : <span className="text-xs text-white/20">Resolved</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {logs.filter(l => l.central_output).length === 0 && <div className="text-white/30 text-sm text-center py-8">No history yet.</div>}
              {[...logs].filter(l => l.central_output).reverse().map(l => (
                <Card key={l.id}>
                  <div className="text-xs text-white/30 mb-2">{format(parseISO(l.date), 'EEEE, d MMM yyyy')}</div>
                  <p className="text-sm text-white/60 leading-relaxed">{l.central_output}</p>
                </Card>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
