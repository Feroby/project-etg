'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import { Card, MetricCard, Badge, Tabs } from '@/components/ui'
import { format, parseISO } from 'date-fns'

export default function CentralPage() {
  const [tab, setTab] = useState('synthesis')
  const [logs, setLogs] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [flags, setFlags] = useState<any[]>([])
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const latest = logs[logs.length - 1]
  const unresolvedFlags = flags.filter(f => !f.resolved)

  async function resolveFlag(id: string) {
    await supabase.from('guardrail_flags').update({ resolved: true }).eq('id', id)
    setFlags(prev => prev.map(f => f.id === id ? { ...f, resolved: true } : f))
  }

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
              <p className="text-xs text-white/40">Head performance coach · Goal arbiter · Cross-domain synthesis</p>
            </div>
            {unresolvedFlags.length > 0 && (
              <Badge color="purple">{unresolvedFlags.length} active flags</Badge>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Nutrition logs" value={logs.filter(l => l.calories).length} />
            <MetricCard label="Recovery logs" value={logs.filter(l => l.hrv).length} />
            <MetricCard label="Strength sessions" value={sessions.length} />
            <MetricCard label="Active flags" value={unresolvedFlags.length} />
          </div>

          <Tabs
            tabs={[{ id: 'synthesis', label: 'Latest synthesis' }, { id: 'chat', label: 'Chat' }, { id: 'flags', label: 'Flags & alerts' }, { id: 'history', label: 'History' }]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'synthesis' && (
            <div className="space-y-4">
              {latest?.central_output ? (
                <Card accent="purple">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-etg-purple uppercase tracking-wider">Latest synthesis</div>
                    {latest?.date && <div className="text-xs text-white/30">{format(parseISO(latest.date), 'EEEE, d MMM')}</div>}
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{latest.central_output}</p>
                </Card>
              ) : (
                <Card accent="purple">
                  <div className="text-center py-8">
                    <div className="text-white/20 text-sm mb-2">No synthesis yet</div>
                    <div className="text-white/20 text-xs">Submit logs via the Nutrition and Recovery tabs to trigger the central coach pipeline</div>
                  </div>
                </Card>
              )}

              {/* Cross-domain snapshot */}
              {logs.length > 0 && (
                <Card>
                  <div className="text-xs text-white/30 uppercase tracking-wider mb-3">Cross-domain snapshot — last 7 days</div>
                  <div className="space-y-2">
                    {[...logs].slice(-7).map((l) => (
                      <div key={l.id} className="flex items-center gap-3 text-xs">
                        <div className="w-16 text-white/30 flex-shrink-0">{format(parseISO(l.date), 'dd MMM')}</div>
                        <div className="flex gap-4 flex-1">
                          {l.weight && <span className="text-etg-green">{l.weight}kg</span>}
                          {l.calories && <span className="text-etg-green">{l.calories}kcal</span>}
                          {l.hrv && <span className="text-etg-amber">HRV {l.hrv}ms</span>}
                          {l.whoop_recovery && <span className="text-etg-amber">{l.whoop_recovery}% rec</span>}
                          {l.sleep_hours && <span className="text-etg-amber">{l.sleep_hours}hr sleep</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {tab === 'chat' && (
            <Card accent="purple" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8">
                <div className="text-xs text-white/40">Ask the central coach about patterns, goal progress, cross-domain decisions — this is the highest-level view of your performance</div>
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
                    {!f.resolved && (
                      <button
                        onClick={() => resolveFlag(f.id)}
                        className="text-xs text-white/30 hover:text-white/60 flex-shrink-0 border border-white/10 rounded px-2 py-1"
                      >
                        Resolve
                      </button>
                    )}
                    {f.resolved && <span className="text-xs text-white/20">Resolved</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {logs.filter(l => l.central_output).length === 0 && <div className="text-white/30 text-sm text-center py-8">No synthesis history yet.</div>}
              {[...logs].filter(l => l.central_output).reverse().map((l) => (
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
