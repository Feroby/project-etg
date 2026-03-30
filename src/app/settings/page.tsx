'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { Card, Button, Input, Select, Textarea, Divider, Spinner } from '@/components/ui'

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('*').single().then(({ data }) => {
      setSettings(data || {})
      setLoading(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const fd = new FormData(e.currentTarget)

    const data: any = {}
    fd.forEach((value, key) => {
      const num = parseFloat(value as string)
      data[key] = value === '' ? null : (!isNaN(num) && value !== '' ? num : value)
    })

    const { error } = await supabase.from('settings').upsert({ id: 1, ...data, updated_at: new Date().toISOString() })
    if (!error) {
      setSettings(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setSaving(false)
  }

  function val(key: string) {
    return settings?.[key] ?? ''
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
        <div className="max-w-2xl mx-auto">

          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Settings</h1>
            <p className="text-white/40 text-sm mt-0.5">Configure your targets and baselines — coaches use these in every response</p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* Body composition */}
            <Card className="mb-4">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Body composition</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Input label="Current weight (kg)" id="current_weight" type="number" placeholder="82.5" step="0.1" />
                <Input label="Goal weight (kg)" id="goal_weight" type="number" placeholder="95" step="0.1" />
                <Input label="Target date" id="target_date" type="text" placeholder="e.g. Dec 2025" />
              </div>
            </Card>

            {/* Nutrition targets */}
            <Card className="mb-4">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Nutrition targets</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Input label="Daily calories" id="daily_calories" type="number" placeholder="2600" />
                <Input label="Daily water (litres)" id="daily_water" type="number" placeholder="3" step="0.25" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Protein (g)" id="daily_protein" type="number" placeholder="190" />
                <Input label="Carbs (g)" id="daily_carbs" type="number" placeholder="300" />
                <Input label="Fat (g)" id="daily_fat" type="number" placeholder="85" />
              </div>
            </Card>

            {/* Recovery baselines */}
            <Card className="mb-4">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Recovery baselines</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Input label="HRV baseline (ms)" id="hrv_baseline" type="number" placeholder="70" />
                <Input label="HRV minimum (ms)" id="hrv_minimum" type="number" placeholder="55" />
                <Input label="Target sleep (hours)" id="sleep_target" type="number" placeholder="8" step="0.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Min Whoop recovery %" id="whoop_min_recovery" type="number" placeholder="50" />
                <Input label="Max Whoop strain" id="whoop_max_strain" type="number" placeholder="15" step="0.1" />
              </div>
            </Card>

            {/* Training profile */}
            <Card className="mb-4">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Training profile</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Input label="Training days per week" id="training_days_per_week" type="number" placeholder="3" min="1" max="7" />
                <Input label="Current block" id="current_block" type="text" placeholder="6-week squat reintroduction" />
              </div>
              <div className="mb-3">
                <label className="text-xs text-white/50 mb-1 block">Primary goal</label>
                <select
                  id="training_goal"
                  name="training_goal"
                  defaultValue={val('training_goal')}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-white/30"
                >
                  <option value="">Select...</option>
                  <option value="Muscle gain (bulk)">Muscle gain (bulk)</option>
                  <option value="Fat loss (cut)">Fat loss (cut)</option>
                  <option value="Recomp">Recomp</option>
                  <option value="Strength peaking">Strength peaking</option>
                  <option value="General fitness">General fitness</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-white/50">Athlete background (coaches read this)</label>
                <textarea
                  id="athlete_background"
                  name="athlete_background"
                  defaultValue={val('athlete_background')}
                  rows={3}
                  placeholder="e.g. 3 years lifting. Bench PR 115kg. Pre-layoff squat 130-140kg. 12 weeks no lower body. Does BJJ 1x/week. Goal weight 95kg..."
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
                />
              </div>
            </Card>

            {/* Guardrail thresholds */}
            <Card className="mb-6">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">Guardrail thresholds</div>
              <div className="text-xs text-white/30 mb-3">These trigger automatic alerts to the central coach</div>
              <div className="grid grid-cols-3 gap-3">
                <Input label="HRV flag after (days)" id="hrv_flag_days" type="number" placeholder="3" min="1" />
                <Input label="Strain flag after (days)" id="strain_flag_days" type="number" placeholder="2" min="1" />
                <Input label="Weight plateau (days)" id="weight_plateau_days" type="number" placeholder="10" min="1" />
              </div>
            </Card>

            <Button color="purple" disabled={saving} className="w-full">
              {saving ? <span className="flex items-center justify-center gap-2"><Spinner />Saving...</span> : 'Save settings'}
            </Button>
            {saved && <div className="text-center text-etg-green text-sm mt-3">Settings saved — coaches updated.</div>}

          </form>
        </div>
      </main>
    </div>
  )
}
