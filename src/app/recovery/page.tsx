'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import CoachResponse from '@/components/CoachResponse'
import { Card, MetricCard, Button, Input, Textarea, Divider, Tabs, Spinner, Badge } from '@/components/ui'
import { format, parseISO } from 'date-fns'

// Convert decimal hours to h + m display
function hoursToHM(h: number | null): string {
  if (!h) return ''
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

// Convert h + m inputs to decimal hours
function hmToHours(h: string, m: string): number | null {
  const hours = parseInt(h) || 0
  const mins = parseInt(m) || 0
  if (!hours && !mins) return null
  return parseFloat((hours + mins / 60).toFixed(4))
}

export default function RecoveryPage() {
  const [tab, setTab] = useState('log')
  const [logs, setLogs] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [chatHistory, setChatHistory] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [yesterdayLog, setYesterdayLog] = useState<any>(null)
  const today = format(new Date(), 'yyyy-MM-dd')

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
      const todayEntry = (l || []).find((x: any) => x.date === today)
      setSelectedLog(todayEntry || null)
      const sorted = (l || []).filter((x: any) => x.date < today).sort((a: any, b: any) => b.date.localeCompare(a.date))
      setYesterdayLog(sorted[0] || null)
      setLoading(false)
    }
    load()
  }, [])

  function handleDateChange(date: string) {
    setSelectedDate(date)
    const existing = logs.find(l => l.date === date)
    setSelectedLog(existing || null)
    setResult(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    const fd = new FormData(e.currentTarget)
    const sleepH = fd.get('sleep_h') as string
    const sleepM = fd.get('sleep_m') as string
    const recoveryData = {
      date: selectedDate,
      hrv: parseInt(fd.get('hrv') as string) || null,
      rhr: parseInt(fd.get('rhr') as string) || null,
      sleep_hours: hmToHours(sleepH, sleepM),
      sleep_quality: parseInt(fd.get('sleep_quality') as string) || null,
      whoop_recovery: parseInt(fd.get('whoop_recovery') as string) || null,
      whoop_strain: parseFloat(fd.get('whoop_strain') as string) || null,
      soreness: parseInt(fd.get('soreness') as string) || null,
      recovery_notes: fd.get('recovery_notes'),
    }
    const body = selectedLog
      ? { ...selectedLog, ...recoveryData }
      : { ...recoveryData, weight: null, calories: null, protein: null, carbs: null, fat: null, water: null }

    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json()).then(data => {
      setResult(data)
      setSelectedLog({ ...selectedLog, ...recoveryData })
      supabase.from('daily_logs').select('*').order('date', { ascending: true }).then(({ data: l }) => setLogs(l || []))
    }).catch(() => setResult({ error: 'Submission failed. Please try again.' }))
    .finally(() => setSubmitting(false))
  }

  const avg = (key: string) => {
    const vals = logs.map(l => l[key]).filter(Boolean)
    return vals.length ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
  }

  const hrvData = logs.filter(l => l.hrv).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), hrv: l.hrv }))
  const sleepData = logs.filter(l => l.sleep_hours).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), sleep: l.sleep_hours }))
  const recData = logs.filter(l => l.whoop_recovery).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), recovery: l.whoop_recovery }))
  const alreadyLogged = !!selectedLog?.hrv
  const isToday = selectedDate === today

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
            <div><h1 className="text-lg font-semibold text-white">Recovery Coach</h1><p className="text-xs text-white/40">Dr. James Hartley · PhD Exercise Physiology</p></div>
            <Badge color="amber">{logs.filter(l => l.hrv).length} days logged</Badge>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Avg HRV" value={avg('hrv')?.toFixed(0) ?? '—'} unit="ms" />
            <MetricCard label="Avg sleep" value={avg('sleep_hours') ? hoursToHM(avg('sleep_hours')) : '—'} />
            <MetricCard label="Avg RHR" value={avg('rhr')?.toFixed(0) ?? '—'} unit="bpm" />
            <MetricCard label="Avg recovery" value={avg('whoop_recovery')?.toFixed(0) ?? '—'} unit="%" />
          </div>
          <Tabs tabs={[{ id: 'log', label: 'Log' }, { id: 'chat', label: 'Chat' }, { id: 'trends', label: 'Trends' }, { id: 'history', label: 'History' }]} active={tab} onChange={setTab} />

          {tab === 'log' && (
            <Card accent="amber">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-white/40">Date</label>
                  <input type="date" value={selectedDate} onChange={e => handleDateChange(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                  {!isToday && <span className="text-[10px] bg-etg-amber/20 text-etg-amber px-2 py-0.5 rounded-full">Editing past date</span>}
                </div>
                <div className="flex items-center gap-2">
                  {alreadyLogged && !submitting && <div className="text-xs bg-etg-amber/20 text-etg-amber px-2 py-0.5 rounded-full">Logged ✓</div>}
                  {submitting && <div className="text-xs text-white/40 flex items-center gap-1"><Spinner size="sm" /> Saving...</div>}
                </div>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><Input label="Soreness (1–10)" id="soreness" type="number" placeholder="3" min="1" max="10" />{yesterdayLog?.soreness && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.soreness}/10</div>}</div>
                  <div><Input label="Sleep quality (1–10)" id="sleep_quality" type="number" placeholder="7" min="1" max="10" />{yesterdayLog?.sleep_quality && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.sleep_quality}/10</div>}</div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div><Input label="HRV (ms)" id="hrv" type="number" placeholder="68" />{yesterdayLog?.hrv && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.hrv}ms</div>}</div>
                  <div><Input label="RHR (bpm)" id="rhr" type="number" placeholder="52" />{yesterdayLog?.rhr && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.rhr}bpm</div>}</div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Sleep</label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input id="sleep_h" name="sleep_h" type="number" placeholder="7" min="0" max="16"
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full pr-5" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">h</span>
                      </div>
                      <div className="relative flex-1">
                        <input id="sleep_m" name="sleep_m" type="number" placeholder="30" min="0" max="59" step="5"
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full pr-5" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">m</span>
                      </div>
                    </div>
                    {yesterdayLog?.sleep_hours && <div className="text-[10px] text-white/25 mt-1">Yesterday: {hoursToHM(yesterdayLog.sleep_hours)}</div>}
                  </div>
                  <div><Input label="Whoop recovery %" id="whoop_recovery" type="number" placeholder="72" min="0" max="100" />{yesterdayLog?.whoop_recovery && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.whoop_recovery}%</div>}</div>
                </div>
                <div className="mb-3">
                  <Input label="Whoop strain" id="whoop_strain" type="number" placeholder="14.2" step="0.1" />
                  {yesterdayLog?.whoop_strain && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.whoop_strain}</div>}
                </div>
                <Textarea label="Notes (stress, life load, anything affecting recovery)" id="recovery_notes" placeholder="e.g. stressful day at work, shoulder tight..." />
                {yesterdayLog?.recovery_notes && <div className="text-[10px] text-white/25 mt-1 mb-3">Yesterday: {yesterdayLog.recovery_notes}</div>}
                <Divider />
                <Button color="amber" disabled={submitting} className="w-full">
                  {submitting ? <span className="flex items-center justify-center gap-2"><Spinner />Saving...</span> : alreadyLogged ? "Update log" : 'Submit to recovery coach'}
                </Button>
              </form>
              {result && !result.error && <CoachResponse text={result.recovery} color="amber" />}
              {result?.error && <div className="mt-4 text-sm text-red-400">{result.error}</div>}
            </Card>
          )}
          {tab === 'chat' && (
            <Card accent="amber" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8"><div className="text-xs text-white/40">Full conversation with Dr. Hartley</div></div>
              <div className="flex-1 min-h-0"><ChatInterface coach="recovery" initialMessages={chatHistory} /></div>
            </Card>
          )}
          {tab === 'trends' && (
            <div className="space-y-4">
              <Card><TrendChart data={hrvData} dataKey="hrv" color="#BA7517" label="HRV (ms)" referenceValue={settings?.hrv_minimum} unit="ms" /></Card>
              <Card><TrendChart data={sleepData} dataKey="sleep" color="#EF9F27" label="Sleep (hours)" referenceValue={settings?.sleep_target} unit="hr" /></Card>
              <Card><TrendChart data={recData} dataKey="recovery" color="#854F0B" label="Whoop recovery %" referenceValue={settings?.whoop_min_recovery} unit="%" /></Card>
            </div>
          )}
          {tab === 'history' && (
            <div className="space-y-3">
              {logs.filter(l => l.hrv).length === 0 && <div className="text-white/30 text-sm text-center py-8">No recovery logs yet.</div>}
              {[...logs].filter(l => l.hrv).reverse().map((l) => (
                <Card key={l.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white">{format(parseISO(l.date), 'EEEE, d MMM yyyy')}</div>
                    <div className="flex gap-2"><Badge color="amber">HRV {l.hrv}ms</Badge><Badge color="amber">{l.whoop_recovery}% rec</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs text-white/50">
                    <span>RHR: {l.rhr}bpm</span>
                    <span>Sleep: {hoursToHM(l.sleep_hours)}</span>
                    <span>Strain: {l.whoop_strain}</span>
                    <span>Soreness: {l.soreness}/10</span>
                  </div>
                  {l.recovery_output && <CoachResponse text={l.recovery_output} color="amber" />}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
