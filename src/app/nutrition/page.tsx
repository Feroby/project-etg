'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ChatInterface from '@/components/ChatInterface'
import TrendChart from '@/components/TrendChart'
import CoachResponse from '@/components/CoachResponse'
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
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [yesterdayLog, setYesterdayLog] = useState<any>(null)

  // Scan / prefill state
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [prefilled, setPrefilled] = useState<any>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form field state (controlled so we can prefill from scan)
  const [fWeight, setFWeight] = useState('')
  const [fWater, setFWater] = useState('')
  const [fCalories, setFCalories] = useState('')
  const [fProtein, setFProtein] = useState('')
  const [fCarbs, setFCarbs] = useState('')
  const [fFat, setFFat] = useState('')
  const [fMealQuality, setFMealQuality] = useState('')
  const [fNotes, setFNotes] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')

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

  // Handle image selection — scan immediately
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanResult(null)

    // Show preview
    const previewUrl = URL.createObjectURL(file)
    setScanPreview(previewUrl)

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // strip data:image/...;base64,
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/scan-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setScanResult(data)

      // Pre-fill form fields with extracted values
      if (data.calories) setFCalories(String(data.calories))
      if (data.protein) setFProtein(String(data.protein))
      if (data.carbs) setFCarbs(String(data.carbs))
      if (data.fat) setFFat(String(data.fat))
      if (data.water) setFWater(String(data.water))
      // Track which fields were auto-filled so we can highlight them
      setPrefilled({
        calories: !!data.calories,
        protein: !!data.protein,
        carbs: !!data.carbs,
        fat: !!data.fat,
        water: !!data.water,
      })
      // Auto-set notes from meal summary
      if (data.meal_summary && !fNotes) setFNotes(data.meal_summary)
    } catch (err: any) {
      setScanResult({ error: err.message || 'Could not read image' })
    } finally {
      setScanning(false)
    }
  }

  function clearScan() {
    setScanResult(null)
    setScanPreview(null)
    setPrefilled({})
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    const body = {
      coach: 'nutrition',
      date: selectedDate,
      weight: parseFloat(fWeight) || null,
      water: parseFloat(fWater) || null,
      calories: parseInt(fCalories) || null,
      protein: parseInt(fProtein) || null,
      carbs: parseInt(fCarbs) || null,
      fat: parseInt(fFat) || null,
      meal_quality: fMealQuality || null,
      nutrition_notes: fNotes || null,
    }
    try {
      const res = await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
      setSelectedLog((prev: any) => ({ ...prev, ...body }))
      const { data: l } = await supabase.from('daily_logs').select('*').order('date', { ascending: true })
      setLogs(l || [])
    } catch (err: any) {
      setResult({ error: err.message || 'Submission failed. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const avg = (key: string) => {
    const vals = logs.map(l => l[key]).filter(Boolean)
    return vals.length ? (vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null
  }

  const latest = logs[logs.length - 1]
  const weightData = logs.filter(l => l.weight).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), weight: l.weight }))
  const calData = logs.filter(l => l.calories).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), calories: l.calories }))
  const protData = logs.filter(l => l.protein).map(l => ({ date: format(parseISO(l.date), 'dd/MM'), protein: l.protein }))
  const alreadyLogged = !!selectedLog?.calories
  const isToday = selectedDate === today

  // Shared input class — highlighted if auto-filled
  function inputClass(field: string) {
    return prefilled[field]
      ? 'ring-1 ring-etg-green/50 bg-etg-green/5 border-etg-green/30'
      : ''
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
            <div className="w-8 h-8 rounded-full bg-etg-green/20 flex items-center justify-center text-sm font-bold text-etg-green">N</div>
            <div><h1 className="text-lg font-semibold text-white">Nutrition Coach</h1><p className="text-xs text-white/40">Dr. Sarah Mitchell · PhD Sports Nutrition</p></div>
            <Badge color="green">{logs.length} days logged</Badge>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <MetricCard label="Avg calories" value={avg('calories')?.toFixed(0) ?? '—'} />
            <MetricCard label="Avg protein" value={avg('protein')?.toFixed(0) ?? '—'} unit="g" />
            <MetricCard label="Avg water" value={avg('water')?.toFixed(1) ?? '—'} unit="L" />
            <MetricCard label="Latest weight" value={latest?.weight ?? '—'} unit="kg" />
          </div>
          <Tabs tabs={[{ id: 'log', label: 'Log' }, { id: 'chat', label: 'Chat' }, { id: 'trends', label: 'Trends' }, { id: 'history', label: 'History' }]} active={tab} onChange={setTab} />

          {tab === 'log' && (
            <Card accent="green">
              {/* Date + status row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-white/40">Date</label>
                  <input type="date" value={selectedDate} onChange={e => handleDateChange(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                  {!isToday && <span className="text-[10px] bg-etg-amber/20 text-etg-amber px-2 py-0.5 rounded-full">Editing past date</span>}
                </div>
                <div className="flex items-center gap-2">
                  {result?.saved && !submitting && <div className="text-xs bg-etg-green/20 text-etg-green px-2.5 py-1 rounded-full">✓ Saved & sent to coach</div>}
                  {alreadyLogged && !submitting && !result?.saved && <div className="text-xs bg-etg-green/20 text-etg-green px-2 py-0.5 rounded-full">Logged ✓</div>}
                  {submitting && <div className="text-xs text-white/40 flex items-center gap-1.5"><Spinner size="sm" /> Sending to coach...</div>}
                </div>
              </div>

              {/* ── IMAGE SCAN ZONE ── */}
              <div className="mb-4">
                {!scanPreview ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-dashed border-white/15 hover:border-etg-green/40 hover:bg-etg-green/5 rounded-xl py-3 px-4 transition-all flex items-center justify-center gap-2.5 group"
                  >
                    <div className="w-6 h-6 rounded-full bg-white/8 group-hover:bg-etg-green/20 flex items-center justify-center transition-all">
                      <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-etg-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-medium text-white/50 group-hover:text-white/70 transition-all">Scan nutrition screenshot</div>
                      <div className="text-[10px] text-white/25">MyFitnessPal, Cronometer, or any food diary — auto-fills macros</div>
                    </div>
                  </button>
                ) : (
                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    {/* Preview + scan status */}
                    <div className="flex items-start gap-3 p-3">
                      <img src={scanPreview} alt="Scan preview" className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-white/10" />
                      <div className="flex-1 min-w-0">
                        {scanning && (
                          <div className="flex items-center gap-2 mt-1">
                            <Spinner size="sm" />
                            <span className="text-xs text-white/50">Scanning for nutrition data...</span>
                          </div>
                        )}
                        {scanResult && !scanResult.error && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-etg-green" />
                              <span className="text-xs font-medium text-etg-green">Scan complete</span>
                              <span className="text-[10px] text-white/25 ml-1">
                                {scanResult.confidence === 'high' ? 'High confidence' : scanResult.confidence === 'medium' ? 'Medium confidence — check values' : 'Low confidence — verify manually'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {scanResult.calories && <span className="text-[10px] bg-etg-green/10 text-etg-green px-1.5 py-0.5 rounded">{scanResult.calories} kcal</span>}
                              {scanResult.protein && <span className="text-[10px] bg-etg-green/10 text-etg-green px-1.5 py-0.5 rounded">P {scanResult.protein}g</span>}
                              {scanResult.carbs && <span className="text-[10px] bg-etg-green/10 text-etg-green px-1.5 py-0.5 rounded">C {scanResult.carbs}g</span>}
                              {scanResult.fat && <span className="text-[10px] bg-etg-green/10 text-etg-green px-1.5 py-0.5 rounded">F {scanResult.fat}g</span>}
                              {scanResult.water && <span className="text-[10px] bg-etg-green/10 text-etg-green px-1.5 py-0.5 rounded">{scanResult.water}L</span>}
                            </div>
                            {scanResult.meal_summary && (
                              <p className="text-[10px] text-white/30 mt-1.5 leading-relaxed">{scanResult.meal_summary}</p>
                            )}
                          </div>
                        )}
                        {scanResult?.error && (
                          <div className="text-xs text-red-400 mt-1">{scanResult.error}</div>
                        )}
                      </div>
                      <button onClick={clearScan} className="text-white/20 hover:text-white/50 text-sm flex-shrink-0 mt-0.5 transition-colors">✕</button>
                    </div>
                    {scanResult && !scanResult.error && (
                      <div className="px-3 pb-2">
                        <div className="text-[10px] text-white/25 flex items-center gap-1">
                          <span className="text-etg-green">●</span> Fields highlighted in green were auto-filled — edit any values before submitting
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* ── FORM ── */}
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Morning weight (kg)</label>
                    <input value={fWeight} onChange={e => setFWeight(e.target.value)} type="number" placeholder="82.5" step="0.1"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full" />
                    {yesterdayLog?.weight && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.weight}kg</div>}
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Water (litres)</label>
                    <input value={fWater} onChange={e => setFWater(e.target.value)} type="number" placeholder="2.5" step="0.25"
                      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full ${inputClass('water')}`} />
                    {yesterdayLog?.water && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.water}L</div>}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="text-xs text-white/50 block mb-1">Meal quality</label>
                  <select value={fMealQuality} onChange={e => setFMealQuality(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 w-full">
                    <option value="">Select...</option>
                    <option value="Excellent — clean, on plan">Excellent — clean, on plan</option>
                    <option value="Good — mostly on track">Good — mostly on track</option>
                    <option value="Average — some slippage">Average — some slippage</option>
                    <option value="Poor — off plan">Poor — off plan</option>
                  </select>
                  {yesterdayLog?.meal_quality && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.meal_quality}</div>}
                </div>

                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Calories</label>
                    <input value={fCalories} onChange={e => setFCalories(e.target.value)} type="number" placeholder="2600"
                      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full ${inputClass('calories')}`} />
                    {yesterdayLog?.calories && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.calories}</div>}
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Protein (g)</label>
                    <input value={fProtein} onChange={e => setFProtein(e.target.value)} type="number" placeholder="190"
                      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full ${inputClass('protein')}`} />
                    {yesterdayLog?.protein && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.protein}g</div>}
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Carbs (g)</label>
                    <input value={fCarbs} onChange={e => setFCarbs(e.target.value)} type="number" placeholder="300"
                      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full ${inputClass('carbs')}`} />
                    {yesterdayLog?.carbs && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.carbs}g</div>}
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1">Fat (g)</label>
                    <input value={fFat} onChange={e => setFFat(e.target.value)} type="number" placeholder="85"
                      className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full ${inputClass('fat')}`} />
                    {yesterdayLog?.fat && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.fat}g</div>}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/50 block mb-1">Notes (hunger, cravings, how eating felt)</label>
                  <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2}
                    placeholder="e.g. felt hungry mid afternoon..."
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none w-full" />
                  {yesterdayLog?.nutrition_notes && <div className="text-[10px] text-white/25 mt-1">Yesterday: {yesterdayLog.nutrition_notes}</div>}
                </div>

                <Divider />
                <Button color="green" disabled={submitting || scanning} className="w-full">
                  {submitting
                    ? <span className="flex items-center justify-center gap-2"><Spinner />Sending to coach...</span>
                    : scanning
                    ? <span className="flex items-center justify-center gap-2"><Spinner />Scanning image...</span>
                    : alreadyLogged ? 'Update log' : 'Submit to nutrition coach'}
                </Button>
              </form>

              {result && !result.error && <CoachResponse text={result.nutrition} color="green" />}
              {result?.error && <div className="mt-4 text-sm text-red-400">{result.error}</div>}
            </Card>
          )}

          {tab === 'chat' && (
            <Card accent="green" className="h-[560px] flex flex-col p-0 overflow-hidden">
              <div className="p-3 border-b border-white/8"><div className="text-xs text-white/40">Full conversation with Dr. Mitchell</div></div>
              <div className="flex-1 min-h-0"><ChatInterface coach="nutrition" initialMessages={chatHistory} /></div>
            </Card>
          )}
          {tab === 'trends' && (
            <div className="space-y-4">
              <Card><TrendChart data={weightData} dataKey="weight" color="#1D9E75" label="Body weight (kg)" referenceValue={settings?.goal_weight} unit="kg" /></Card>
              <Card><TrendChart data={calData} dataKey="calories" color="#63991a" label="Daily calories" referenceValue={settings?.daily_calories} unit="kcal" /></Card>
              <Card><TrendChart data={protData} dataKey="protein" color="#0F6E56" label="Protein (g)" referenceValue={settings?.daily_protein} unit="g" /></Card>
            </div>
          )}
          {tab === 'history' && (
            <div className="space-y-3">
              {logs.length === 0 && <div className="text-white/30 text-sm text-center py-8">No logs yet.</div>}
              {[...logs].reverse().map((l) => (
                <Card key={l.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-white">{format(parseISO(l.date), 'EEEE, d MMM yyyy')}</div>
                    <div className="flex gap-2"><Badge color="green">{l.weight}kg</Badge><Badge color="green">{l.calories}kcal</Badge></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs text-white/50">
                    <span>P: {l.protein}g</span><span>C: {l.carbs}g</span><span>F: {l.fat}g</span><span>W: {l.water}L</span>
                  </div>
                  {l.nutrition_output && <CoachResponse text={l.nutrition_output} color="green" />}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
