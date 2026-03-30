'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Card } from '@/components/ui'

function Row({ label, value, unit }: { label: string; value: any; unit?: string }) {
  const display = value !== null && value !== undefined && value !== '' ? `${value}${unit ? ' ' + unit : ''}` : '—'
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className={`text-sm font-medium ${display === '—' ? 'text-white/20' : 'text-white'}`}>{display}</span>
    </div>
  )
}

function Field({ label, id, type = 'text', placeholder, step, min, max, value, onChange }: any) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-white/50">{label}</label>
      <input id={id} name={id} type={type} placeholder={placeholder} step={step} min={min} max={max}
        value={value ?? ''} onChange={e => onChange(id, e.target.value)}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full" />
    </div>
  )
}

export default function SettingsPage() {
  const [saved, setSaved] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      setSaved(data || {})
      setForm(data || {})
      setLoading(false)
    })
  }, [])

  function update(key: string, value: string) {
    setForm((prev: any) => ({ ...prev, [key]: value }))
  }

  function startEdit() { setForm({ ...saved }); setEditing(true); setMsg('') }
  function cancelEdit() { setForm({ ...saved }); setEditing(false); setMsg('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const data: any = { id: 1, updated_at: new Date().toISOString() }
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'id' || k === 'updated_at') return
      const num = parseFloat(v as string)
      data[k] = (v === '' || v === null || v === undefined) ? null : (!isNaN(num) ? num : v)
    })
    const { error } = await supabase.from('settings').upsert(data)
    if (!error) {
      setSaved({ ...data }); setEditing(false); setMsg('Saved successfully')
      setTimeout(() => setMsg(''), 3000)
    } else {
      setMsg('Error saving — please try again')
    }
    setSaving(false)
  }

  const hasData = saved && Object.entries(saved).some(([k, v]) => !['id','updated_at'].includes(k) && v !== null && v !== undefined && v !== '')

  if (loading) return (
    <div className="flex h-screen bg-[#0a0a0a]"><Sidebar />
      <main className="ml-52 flex-1 flex items-center justify-center"><div className="text-white/30 text-sm">Loading...</div></main>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <Sidebar />
      <main className="ml-52 flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white">Settings</h1>
              <p className="text-white/40 text-sm mt-0.5">Your targets and baselines — used by all coaches</p>
            </div>
            {!editing ? (
              <button onClick={startEdit} className="px-4 py-2 text-sm font-medium border border-etg-purple/50 text-etg-purple rounded-lg hover:bg-etg-purple/10 transition-all">
                {hasData ? 'Edit settings' : 'Set up settings'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm text-white/40 border border-white/10 rounded-lg hover:bg-white/5 transition-all">Cancel</button>
                <button form="settings-form" type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-etg-purple hover:bg-etg-purple/80 disabled:opacity-40 text-white rounded-lg transition-all flex items-center gap-2">
                  {saving && <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            )}
          </div>

          {msg && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${msg.includes('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-etg-green/10 text-etg-green border border-etg-green/20'}`}>
              {msg}
            </div>
          )}

          {!editing && (
            <div className="space-y-4">
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Body composition</div>
                <Row label="Current weight" value={saved?.current_weight} unit="kg" />
                <Row label="Goal weight" value={saved?.goal_weight} unit="kg" />
                <Row label="Target date" value={saved?.target_date} />
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Nutrition targets</div>
                <Row label="Daily calories" value={saved?.daily_calories} unit="kcal" />
                <Row label="Daily water" value={saved?.daily_water} unit="L" />
                <Row label="Protein" value={saved?.daily_protein} unit="g" />
                <Row label="Carbs" value={saved?.daily_carbs} unit="g" />
                <Row label="Fat" value={saved?.daily_fat} unit="g" />
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Recovery baselines</div>
                <Row label="HRV baseline" value={saved?.hrv_baseline} unit="ms" />
                <Row label="HRV minimum" value={saved?.hrv_minimum} unit="ms" />
                <Row label="Target sleep" value={saved?.sleep_target} unit="hr" />
                <Row label="Min Whoop recovery" value={saved?.whoop_min_recovery} unit="%" />
                <Row label="Max Whoop strain" value={saved?.whoop_max_strain} />
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Training profile</div>
                <Row label="Training days/week" value={saved?.training_days_per_week} />
                <Row label="Current block" value={saved?.current_block} />
                <Row label="Primary goal" value={saved?.training_goal} />
                {saved?.athlete_background && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="text-xs text-white/40 mb-1">Athlete background</div>
                    <div className="text-sm text-white/70 leading-relaxed">{saved.athlete_background}</div>
                  </div>
                )}
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Guardrail thresholds</div>
                <Row label="HRV flag after" value={saved?.hrv_flag_days} unit="days" />
                <Row label="Strain flag after" value={saved?.strain_flag_days} unit="days" />
                <Row label="Weight plateau" value={saved?.weight_plateau_days} unit="days" />
              </Card>
              {!hasData && <div className="text-center py-8 text-white/30 text-sm">No settings saved yet. Click &quot;Set up settings&quot; to configure your targets.</div>}
            </div>
          )}

          {editing && (
            <form id="settings-form" onSubmit={handleSubmit} className="space-y-4">
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Body composition</div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Current weight (kg)" id="current_weight" type="number" placeholder="82.5" step="0.1" value={form.current_weight} onChange={update} />
                  <Field label="Goal weight (kg)" id="goal_weight" type="number" placeholder="95" step="0.1" value={form.goal_weight} onChange={update} />
                  <Field label="Target date" id="target_date" placeholder="e.g. Dec 2025" value={form.target_date} onChange={update} />
                </div>
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Nutrition targets</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Field label="Daily calories" id="daily_calories" type="number" placeholder="2600" value={form.daily_calories} onChange={update} />
                  <Field label="Daily water (litres)" id="daily_water" type="number" placeholder="3" step="0.25" value={form.daily_water} onChange={update} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Protein (g)" id="daily_protein" type="number" placeholder="190" value={form.daily_protein} onChange={update} />
                  <Field label="Carbs (g)" id="daily_carbs" type="number" placeholder="300" value={form.daily_carbs} onChange={update} />
                  <Field label="Fat (g)" id="daily_fat" type="number" placeholder="85" value={form.daily_fat} onChange={update} />
                </div>
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Recovery baselines</div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Field label="HRV baseline (ms)" id="hrv_baseline" type="number" placeholder="70" value={form.hrv_baseline} onChange={update} />
                  <Field label="HRV minimum (ms)" id="hrv_minimum" type="number" placeholder="55" value={form.hrv_minimum} onChange={update} />
                  <Field label="Target sleep (hours)" id="sleep_target" type="number" placeholder="8" step="0.5" value={form.sleep_target} onChange={update} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Min Whoop recovery %" id="whoop_min_recovery" type="number" placeholder="50" value={form.whoop_min_recovery} onChange={update} />
                  <Field label="Max Whoop strain" id="whoop_max_strain" type="number" placeholder="15" step="0.1" value={form.whoop_max_strain} onChange={update} />
                </div>
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Training profile</div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Field label="Training days per week" id="training_days_per_week" type="number" placeholder="3" min="1" max="7" value={form.training_days_per_week} onChange={update} />
                  <Field label="Current block" id="current_block" placeholder="6-week squat reintroduction" value={form.current_block} onChange={update} />
                </div>
                <div className="mb-3 flex flex-col gap-1">
                  <label className="text-xs text-white/50">Primary goal</label>
                  <select value={form.training_goal ?? ''} onChange={e => update('training_goal', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 w-full">
                    <option value="">Select...</option>
                    <option value="Muscle gain (bulk)">Muscle gain (bulk)</option>
                    <option value="Fat loss (cut)">Fat loss (cut)</option>
                    <option value="Recomp">Recomp</option>
                    <option value="Strength peaking">Strength peaking</option>
                    <option value="General fitness">General fitness</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">Athlete background</label>
                  <textarea value={form.athlete_background ?? ''} onChange={e => update('athlete_background', e.target.value)} rows={3}
                    placeholder="e.g. 3 years lifting. Bench PR 115kg..."
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none" />
                </div>
              </Card>
              <Card>
                <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Guardrail thresholds</div>
                <div className="text-xs text-white/30 mb-3">These trigger automatic alerts to the central coach</div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="HRV flag after (days)" id="hrv_flag_days" type="number" placeholder="3" min="1" value={form.hrv_flag_days} onChange={update} />
                  <Field label="Strain flag after (days)" id="strain_flag_days" type="number" placeholder="2" min="1" value={form.strain_flag_days} onChange={update} />
                  <Field label="Weight plateau (days)" id="weight_plateau_days" type="number" placeholder="10" min="1" value={form.weight_plateau_days} onChange={update} />
                </div>
              </Card>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
