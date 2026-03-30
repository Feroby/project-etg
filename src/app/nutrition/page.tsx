'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import { Card, MetricCard, Button, Input, Select, Textarea, Divider, Tabs, Spinner, Badge } from '@/components/ui'
import { format, parseISO } from 'date-fns'

export default function NutritionPage() {
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
        supabase.from('chat_messages').select('*').eq('coach', 'nutrition').order('created_at', { ascending: true }).limit(100),
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
    const body = {
      date: fd.get('date') || format(new Date(), 'yyyy-MM-dd'),
      weight: parseFloat(fd.get('weight') as string) || null,
      water: parseFloat(fd.get('water') as string) || null,
      calories: parseInt(fd.get('calories') as string) || null,
      protein: parseInt(fd.get('protein') as string) || null,
      carbs: parseInt(fd.get('carbs') as string) || null,
      fat: parseInt(fd.get('fat') as string) || null,
      meal_quality: fd.get('meal_quality'),
      nutrition_notes: fd.get('nutrition_notes'),
      // Recovery defaults (will be filled from recovery tab)
      hrv: null, rhr: null, sleep_hours: null, sleep_quality: null,
      whoop_recovery: null, whoop_strain: null, soreness: null, recovery_notes: null,
    }
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setResult(data)
      // Refresh logs
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

  const latest = logs[logs.length - 1]
  const weightData = logs.filter(l => l.weight).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), weight: l.weight }))
  const calData = logs.filter(l => l.calories).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), calories: l.calories }))
  const protData = logs.filter(l => l.protein).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), protein: l.protein }))

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
            <div className="w-8 h-8 rounded-full bg-etg-green/20 flex items-center justify-center text-sm font-bold text-etg-green">N</div>
            <div>
              <h1 className="text-lg font-semibold text-white">Nutrition Coach</h1>
              <p className="text-xs text-white/40">Dr. Sarah Mitchell · PhD Sports Nutrition</p>
            </div>
            <Badge color="green">{logs.length} days logged</Badge>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Avg calories" value={avg('calories')?.toFixed(0) ?? '—'} />
            <MetricCard label="Avg protein" value={avg('protein')?.toFixed(0) ?? '—'} unit="g" />
            <MetricCard label="Avg water" value={avg('water')?.toFixed(1) ?? '—'} unit="L" />
            <MetricCard label="Latest weight" value={latest?.weight ?? '—'} unit="kg" />
          </div>

          <Tabs
            tabs={[{ id: 'log', label: 'Log today' }, { id: 'chat', label: 'Chat' }, { id: 'trends', label: 'Trends' }, { id: 'history', label: 'History' }]}
            active={tab}
            onChange={setTab}
          />

          {/* LOG TAB */}
          {tab === 'log' && (
            <Card accent="green">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input label="Date" id="date" type="date" placeholder={format(new Date(), 'yyyy-MM-dd')} />
                  <Input label="Morning weight (kg)" id="weight" type="number" placeholder="82.5" step="0.1" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Input label="Water (litres)" id="water" type="number" placeholder="2.5" step="0.25" />
                  <Select label="Meal quality" id="meal_quality" options={[
                    { value: 'Excellent — clean, on plan', label: 'Excellent — clean, on plan' },
                    { value: 'Good — mostly on track', label: 'Good — mostly on track' },
                    { value: 'Average — some slippage', label: 'Average — some slippage' },
                    { value: 'Poor — off plan', label: 'Poor — off plan' },
                  ]} />
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <Input label="Calories" id="calories" type="number" placeholder="2600" />
                  <Input label="Protein (g)" id="protein" type="number" placeholder="190" />
                  <Input label="Carbs (g)" id="carbs" type="number" placeholder="300" />
                  <Input label="Fat (g)" id="fat" type="number" placeholder="85" />
                </div>
                <Textarea label="Notes (hunger, cravings, how eating felt)" id="nutrition_notes" placeholder="e.g. felt hungry mid afternoon, snacked more than planned..." />
                <Divider />
                <Button color="green" disabled={submitting} className="w-full">
                  {submitting ? <span className="flex items-center justify-center gap-2"><Spinner />Analysing...</span> : 'Submit to nutrition coach'}
                </Button>
              </form>

              {result && !result.error && (
                <div className="mt-4 p-4 bg-etg-green/10 border border-etg-green/20 rounded-xl">
                  <div className="text-xs text-etg-green font-medium mb-2 uppercase tracking-wider">Nutrition coach response</div>
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{result.nutrition}</p>
                  {result.flags?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      {result.flags.map((f: string, i: number) => <div key={i} className="text-xs text-red-400">{f}</div>)}
                    </div>
                  )}
                </div>
              )}
              {result?.error && <div className="mt-4 text-sm text-red-400">{result.error}</div>}
            </Card>
          )}

          {/* CHAT TAB */}
          {tab === 'chat' && (
            <Card accent="green" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8">
                <div className="text-xs text-white/40">Full conversation with Dr. Mitchell — ask anything about nutrition, macros, body composition</div>
              </div>
              <div className="flex-1 min-h-0">
                <ChatInterface coach="nutrition" initialMessages={chatHistory} />
              </div>
            </Card>
          )}

          {/* TRENDS TAB */}
          {tab === 'trends' && (
            <div className="space-y-4">
              <Card>
                <TrendChart data={weightData} dataKey="weight" color="#1D9E75" label="Body weight (kg)" referenceValue={settings?.goal_weight} unit="kg" />
              </Card>
              <Card>
                <TrendChart data={calData} dataKey="calories" color="#63991a" label="Daily calories" referenceValue={settings?.daily_calories} unit="kcal" />
              </Card>
              <Card>
                <TrendChart data={protData} dataKey="protein" color="#0F6E56" label="Protein (g)" referenceValue={settings?.daily_protein} unit="g" />
              </Card>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === 'history' && (
            <div className="space-y-3">
              {logs.length === 0 && <div className="text-white/30 text-sm text-center py-8">No logs yet.</div>}
              {[...logs].reverse().map((l, i) => (
                <Card key={l.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white">{format(parseISO(l.date), 'EEEE, d MMM yyyy')}</div>
                    <div className="flex gap-2">
                      <Badge color="green">{l.weight}kg</Badge>
                      <Badge color="green">{l.calories}kcal</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs text-white/50">
                    <span>P: {l.protein}g</span>
                    <span>C: {l.carbs}g</span>
                    <span>F: {l.fat}g</span>
                    <span>W: {l.water}L</span>
                  </div>
                  {l.nutrition_output && (
                    <div className="text-xs text-white/50 leading-relaxed border-t border-white/8 pt-2">{l.nutrition_output}</div>
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
