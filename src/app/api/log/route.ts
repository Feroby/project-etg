import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat, checkGuardrails, getActiveDirectives } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { coach } = body // 'nutrition' | 'recovery'

    // Fetch everything in parallel — including active directives for this coach
    const [{ data: settings }, { data: logs }, existingResult, directives] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: true }).limit(14),
      supabase.from('daily_logs').select('*').eq('date', body.date).single(),
      getActiveDirectives(coach as 'nutrition' | 'recovery'),
    ])

    const base = existingResult.data || {}
    const recentLogs = (logs || []).filter((l: any) => l.date !== body.date)

    const upsertRow: any = { date: body.date }
    if (coach === 'nutrition') {
      Object.assign(upsertRow, {
        weight: body.weight ?? base.weight ?? null,
        calories: body.calories ?? base.calories ?? null,
        protein: body.protein ?? base.protein ?? null,
        carbs: body.carbs ?? base.carbs ?? null,
        fat: body.fat ?? base.fat ?? null,
        water: body.water ?? base.water ?? null,
        meal_quality: body.meal_quality ?? base.meal_quality ?? null,
        nutrition_notes: body.nutrition_notes ?? base.nutrition_notes ?? null,
        food_items: body.food_items ?? base.food_items ?? null,
        hrv: base.hrv ?? null, rhr: base.rhr ?? null, sleep_hours: base.sleep_hours ?? null,
        sleep_quality: base.sleep_quality ?? null, whoop_recovery: base.whoop_recovery ?? null,
        whoop_strain: base.whoop_strain ?? null, soreness: base.soreness ?? null,
        recovery_notes: base.recovery_notes ?? null,
      })
    } else {
      Object.assign(upsertRow, {
        hrv: body.hrv ?? base.hrv ?? null, rhr: body.rhr ?? base.rhr ?? null,
        sleep_hours: body.sleep_hours ?? base.sleep_hours ?? null,
        sleep_quality: body.sleep_quality ?? base.sleep_quality ?? null,
        whoop_recovery: body.whoop_recovery ?? base.whoop_recovery ?? null,
        whoop_strain: body.whoop_strain ?? base.whoop_strain ?? null,
        soreness: body.soreness ?? base.soreness ?? null,
        recovery_notes: body.recovery_notes ?? base.recovery_notes ?? null,
        weight: base.weight ?? null, calories: base.calories ?? null, protein: base.protein ?? null,
        carbs: base.carbs ?? null, fat: base.fat ?? null, water: base.water ?? null,
        meal_quality: base.meal_quality ?? null, nutrition_notes: base.nutrition_notes ?? null,
        food_items: base.food_items ?? null,
      })
    }

    const msg = coach === 'nutrition'
      ? `Nutrition log: Weight=${body.weight}kg Water=${body.water}L Cal=${body.calories} P=${body.protein}g C=${body.carbs}g F=${body.fat}g Quality="${body.meal_quality}" Notes="${body.nutrition_notes || 'none'}"${upsertRow.food_items ? `\nFood breakdown: ${upsertRow.food_items}` : ''}`
      : `Recovery log: HRV=${body.hrv}ms RHR=${body.rhr}bpm Sleep=${body.sleep_hours}hr(q:${body.sleep_quality}/10) WhoopRec=${body.whoop_recovery}% Strain=${body.whoop_strain} Soreness=${body.soreness}/10 Notes="${body.recovery_notes || 'none'}"`

    // Run specialist with their active directives injected
    const specialistOutput = await runCoachChat(
      coach as 'nutrition' | 'recovery',
      [{ role: 'user', content: msg }],
      settings, recentLogs, [],
      { directives }
    )

    upsertRow.nutrition_output = coach === 'nutrition' ? specialistOutput : (base.nutrition_output ?? null)
    upsertRow.recovery_output = coach === 'recovery' ? specialistOutput : (base.recovery_output ?? null)

    const { error } = await supabase.from('daily_logs').upsert(upsertRow, { onConflict: 'date' })
    if (error) throw error

    // Central + guardrails async
    const allLogs = [...recentLogs, upsertRow]
    Promise.all([
      runCoachChat('central',
        [{ role: 'user', content: `${coach} log submitted (${body.date}). Nutrition: ${upsertRow.nutrition_output || 'none'}. Recovery: ${upsertRow.recovery_output || 'none'}. Brief cross-domain synthesis.` }],
        settings, recentLogs, []
      ).then(centralOutput =>
        supabase.from('daily_logs').update({ central_output: centralOutput }).eq('date', body.date)
      ),
      checkGuardrails(allLogs, settings).then(flags => {
        if (flags.length) supabase.from('guardrail_flags').insert(flags.map(f => ({ flag_type: 'auto', message: f })))
      }),
    ]).catch(e => console.error('Async post-save tasks failed:', e))

    return NextResponse.json({
      [coach === 'nutrition' ? 'nutrition' : 'recovery']: specialistOutput,
      saved: true,
      // Surface any active directives to the UI so they can be displayed
      activeDirectives: directives.map(d => ({ priority: d.priority, directive: d.directive })),
    })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
