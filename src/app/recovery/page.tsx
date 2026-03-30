'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import { Card, MetricCard, Button, Input, Textarea, Divider, Tabs, Spinner, Badge } from '@/components/ui'
import { format, parseISO } from 'date-fns'

export default function RecoveryPage() {
  const [tab, setTab] = useState('log')
  const [logs, setLogs] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: l }, { data: st }, { data: ch }] = await Promise.all([
        supabase.from('daily_logs').select('*').order('date', { ascending: true }),
        supabase.from('settings').select('*').single(),
        supabase.from('chat_messages').select('*').eq('coach', 'recovery').order('created_at', { ascending: true }).limit(100),
      ])
      setLogs(l || [])
      setSettings(st)
      setChatHistory((ch || []).map(m => ({ role: m.role, content: m.content })))
      setLoading(false)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    const fd = new FormData(e.currentTarget)

    // Upsert recovery fields into existing daily log for today, or create
    const date = (fd.get('date') as string) || format(new Date(), 'yyyy-MM-dd')
    const recoveryData = {
      date,
      hrv: parseInt(fd.get('hrv') as string) || null,
      rhr: parseInt(fd.get('rhr') as string) || null,
      sleep_hours: parseFloat(fd.get('sleep_hours') as string) || null,
      sleep_quality: parseInt(fd.get('sleep_quality') as string) || null,
      whoop_recovery: parseInt(fd.get('whoop_recovery') as string) || null,
      whoop_strain: parseFloat(fd.get('whoop_strain') as string) || null,
      soreness: parseInt(fd.get('soreness') as string) || null,
      recovery_notes: fd.get('recovery_notes'),
    }

    try {
      // Check if log exists for this date
      const { data: existing } = await supabase.from('daily_logs').select('*').eq('date', date).single()

      let body: any
      if (existing) {
        // Update recovery fields only
        body = { ...existing, ...recoveryData }
      } else {
        body = { ...recoveryData, weight: null, calories: null, protein: null, carbs: null, fat: null, water: null }
      }

      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(data)
      const { data: l } = await supabase.from('daily_logs').select('*').order('date', { ascending: true })
      setLogs(l || [])
    } catch (err) {
      setResult({ error: 'Submission failed. Please try again.' })
    }
    setSubmitting(false)
  }

  const avg = (key: string) => {
    const vals = logs.map(l => l[key]).filter(Boolean)
    return vals.length ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
  }

  const hrvData = logs.filter(l => l.hrv).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), hrv: l.hrv }))
  const sleepData = logs.filter(l => l.sleep_hours).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), sleep: l.sleep_hours }))
  const recData = logs.filter(l => l.whoop_recovery).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), recovery: l.whoop_recovery }))

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
            <div className="w-8 h-8 rounded-full bg-etg-amber/20 flex items-center justify-center text-sm font-bold text-etg-amber">R</div>
            <div>
              <h1 className="text-lg font-semibold text-white">Recovery Coach</h1>
              <p className="text-xs text-white/40">Dr. James Hartley · PhD Exercise Physiology</p>
            </div>
            <Badge color="amber">{logs.filter(l => l.hrv).length} days logged</Badge>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Avg HRV" value={avg('hrv')?.toFixed(0) ?? '—'} unit="ms" />
            <MetricCard label="Avg sleep" value={avg('sleep_hours')?.toFixed(1) ?? '—'} unit="hr" />
            <MetricCard label="Avg RHR" value={avg('rhr')?.toFixed(0) ?? '—'} unit="bpm" />
            <MetricCard label="Avg recovery" value={avg('whoop_recovery')?.toFixed(0) ?? '—'} unit="%" />
          </div>

          <Tabs
            tabs={[{ id: 'log', label: 'Log today' }, { id: 'chat', label: 'Chat' }, { id: 'trends', label: 'Trends' }, { id: 'history', label: 'History' }]}
            active={tab}
            onChange={setTab}
          />

          {tab === 'log' && (
            <Card accent="amber">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input label="Date" id="date" type="date" />
                  <Input label="Soreness (1–10)" id="soreness" type="number" placeholder="3" min="1" max="10" />
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <Input label="HRV (ms)" id="hrv" type="number" placeholder="68" />
                  <Input label="RHR (bpm)" id="rhr" type="number" placeholder="52" />
                  <Input label="Sleep (hours)" id="sleep_hours" type="number" placeholder="7.5" step="0.25" />
                  <Input label="Sleep quality (1–10)" id="sleep_quality" type="number" placeholder="7" min="1" max="10" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input label="Whoop recovery %" id="whoop_recovery" type="number" placeholder="72" min="0" max="100" />
                  <Input label="Whoop strain" id="whoop_strain" type="number" placeholder="14.2" step="0.1" />
                </div>
                <Textarea label="Notes (stress, life load, anything affecting recovery)" id="recovery_notes" placeholder="e.g. stressful day at work, shoulder tight, late dinner..." />
                <Divider />
                <Button color="amber" disabled={submitting} className="w-full">
                  {submitting ? <span className="flex items-center justify-center gap-2"><Spinner />Analysing...</span> : 'Submit to recovery coach'}
                </Button>
              </form>

              {result && !result.error && (
                <div className="mt-4 p-4 bg-etg-amber/10 border border-etg-amber/20 rounded-xl">
                  <div className="text-xs text-etg-amber font-medium mb-2 uppercase tracking-wider">Recovery coach response</div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{result.recovery}</p>
                </div>
              )}
              {result?.error && <div className="mt-4 text-sm text-red-400">{result.error}</div>}
            </Card>
          )}

          {tab === 'chat' && (
            <Card accent="amber" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8">
                <div className="text-xs text-white/40">Full conversation with Dr. Hartley — ask about HRV patterns, sleep optimisation, recovery protocols</div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatInterface coach="recovery" initialMessages={chatHistory} />
              </div>
            </Card>
          )}

          {tab === 'trends' && (
            <div className="space-y-4">
              <Card>
                <TrendChart data={hrvData} dataKey="hrv" color="#BA7517" label="HRV (ms)" referenceValue={settings?.hrv_minimum} unit="ms" />
              </Card>
              <Card>
                <TrendChart data={sleepData} dataKey="sleep" color="#EF9F27" label="Sleep (hours)" referenceValue={settings?.sleep_target} unit="hr" />
              </Card>
              <Card>
                <TrendChart data={recData} dataKey="recovery" color="#854F0B" label="Whoop recovery %" referenceValue={settings?.whoop_min_recovery} unit="%" />
              </Card>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {logs.filter(l => l.hrv).length === 0 && <div className="text-white/30 text-sm text-center py-8">No recovery logs yet.</div>}
              {[...logs].filter(l => l.hrv).reverse().map((l) => (
                <Card key={l.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white">{format(parseISO(l.date), 'EEEE, d MMM yyyy')}</div>
                    <div className="flex gap-2">
                      <Badge color="amber">HRV {l.hrv}ms</Badge>
                      <Badge color="amber">{l.whoop_recovery}% rec</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs text-white/50">
                    <span>RHR: {l.rhr}bpm</span>
                    <span>Sleep: {l.sleep_hours}hr</span>
                    <span>Strain: {l.whoop_strain}</span>
                    <span>Soreness: {l.soreness}/10</span>
                  </div>
                  {l.recovery_output && (
                    <div className="text-xs text-white/50 leading-relaxed border-t border-white/8 pt-2">{l.recovery_output}</div>
                  )}
                </Card>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
