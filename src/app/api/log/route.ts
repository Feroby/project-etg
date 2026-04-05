import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat, checkGuardrails } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { coach } = body // 'nutrition' | 'recovery'

    const [{ data: settings }, { data: logs }, { data: sessions }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: true }).limit(14),
      supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
    ])

    // Fetch existing log for this date to preserve the other domain's data
    const existingResult = await supabase.from('daily_logs').select('*').eq('date', body.date).single()
    const base = existingResult.data || {}

    // Build upsert row — only touch fields relevant to the submitting coach
    const upsertRow: any = { date: body.date }

    if (coach === 'nutrition') {
      // Nutrition fields from submission
      upsertRow.weight = body.weight ?? base.weight ?? null
      upsertRow.calories = body.calories ?? base.calories ?? null
      upsertRow.protein = body.protein ?? base.protein ?? null
      upsertRow.carbs = body.carbs ?? base.carbs ?? null
      upsertRow.fat = body.fat ?? base.fat ?? null
      upsertRow.water = body.water ?? base.water ?? null
      upsertRow.meal_quality = body.meal_quality ?? base.meal_quality ?? null
      upsertRow.nutrition_notes = body.nutrition_notes ?? base.nutrition_notes ?? null
      // Preserve existing recovery fields untouched
      upsertRow.hrv = base.hrv ?? null
      upsertRow.rhr = base.rhr ?? null
      upsertRow.sleep_hours = base.sleep_hours ?? null
      upsertRow.sleep_quality = base.sleep_quality ?? null
      upsertRow.whoop_recovery = base.whoop_recovery ?? null
      upsertRow.whoop_strain = base.whoop_strain ?? null
      upsertRow.soreness = base.soreness ?? null
      upsertRow.recovery_notes = base.recovery_notes ?? null
    } else if (coach === 'recovery') {
      // Recovery fields from submission
      upsertRow.hrv = body.hrv ?? base.hrv ?? null
      upsertRow.rhr = body.rhr ?? base.rhr ?? null
      upsertRow.sleep_hours = body.sleep_hours ?? base.sleep_hours ?? null
      upsertRow.sleep_quality = body.sleep_quality ?? base.sleep_quality ?? null
      upsertRow.whoop_recovery = body.whoop_recovery ?? base.whoop_recovery ?? null
      upsertRow.whoop_strain = body.whoop_strain ?? base.whoop_strain ?? null
      upsertRow.soreness = body.soreness ?? base.soreness ?? null
      upsertRow.recovery_notes = body.recovery_notes ?? base.recovery_notes ?? null
      // Preserve existing nutrition fields untouched
      upsertRow.weight = base.weight ?? null
      upsertRow.calories = base.calories ?? null
      upsertRow.protein = base.protein ?? null
      upsertRow.carbs = base.carbs ?? null
      upsertRow.fat = base.fat ?? null
      upsertRow.water = base.water ?? null
      upsertRow.meal_quality = base.meal_quality ?? null
      upsertRow.nutrition_notes = base.nutrition_notes ?? null
    }

    const recentLogs = (logs || []).filter(l => l.date !== body.date)
    const recentSessions = (sessions || []).reverse()

    // Run only the relevant specialist coach
    let nutritionOutput = base.nutrition_output ?? null
    let recoveryOutput = base.recovery_output ?? null
    let centralOutput = base.central_output ?? null

    if (coach === 'nutrition') {
      const msg = `Daily nutrition log:
Weight: ${body.weight}kg | Water: ${body.water}L
Calories: ${body.calories} | Protein: ${body.protein}g | Carbs: ${body.carbs}g | Fat: ${body.fat}g
Meal quality: ${body.meal_quality}
Notes: "${body.nutrition_notes || 'none'}"`
      nutritionOutput = await runCoachChat('nutrition', [{ role: 'user', content: msg }], settings, recentLogs, recentSessions)
    }

    if (coach === 'recovery') {
      const msg = `Daily recovery log:
HRV: ${body.hrv}ms | RHR: ${body.rhr}bpm
Sleep: ${body.sleep_hours}hr (quality: ${body.sleep_quality}/10)
Whoop recovery: ${body.whoop_recovery}% | Strain: ${body.whoop_strain}
Soreness: ${body.soreness}/10
Notes: "${body.recovery_notes || 'none'}"`
      recoveryOutput = await runCoachChat('recovery', [{ role: 'user', content: msg }], settings, recentLogs, recentSessions)
    }

    // Always update central coach after any submission
    const centralMsg = `New data submitted (${coach} log, date: ${body.date}).
Latest nutrition output: ${nutritionOutput || 'none yet'}
Latest recovery output: ${recoveryOutput || 'none yet'}
Provide a brief cross-domain synthesis and any immediate priorities.`
    centralOutput = await runCoachChat('central', [{ role: 'user', content: centralMsg }], settings, recentLogs, recentSessions)

    upsertRow.nutrition_output = nutritionOutput
    upsertRow.recovery_output = recoveryOutput
    upsertRow.central_output = centralOutput

    const { error } = await supabase.from('daily_logs').upsert(upsertRow, { onConflict: 'date' })
    if (error) throw error

    // Guardrails
    const flags = await checkGuardrails([...recentLogs, upsertRow], settings)
    if (flags.length) {
      await supabase.from('guardrail_flags').insert(flags.map(f => ({ flag_type: 'auto', message: f })))
    }

    return NextResponse.json({ nutrition: nutritionOutput, recovery: recoveryOutput, central: centralOutput, flags, saved: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
