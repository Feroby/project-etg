import { NextRequest, NextResponse } from 'next/server'
import { runDailyPipeline, checkGuardrails } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { data: settings } = await supabase.from('settings').select('*').single()
    const { data: logs } = await supabase
      .from('daily_logs')
      .select('*')
      .order('date', { ascending: true })
      .limit(14)
    const { data: sessions } = await supabase
      .from('strength_sessions')
      .select('*')
      .order('date', { ascending: false })
      .limit(10)

    // Run all three coaches in pipeline
    const { nutrition, recovery, central } = await runDailyPipeline(
      body,
      settings,
      logs || [],
      (sessions || []).reverse()
    )

    // Check guardrails
    const allLogs = [...(logs || []), { ...body, nutrition_output: nutrition, recovery_output: recovery }]
    const flags = await checkGuardrails(allLogs, settings)

    // Save flags
    if (flags.length) {
      await supabase.from('guardrail_flags').insert(flags.map(f => ({ flag_type: 'auto', message: f })))
    }

    // Upsert the daily log
    const { error } = await supabase.from('daily_logs').upsert({
      date: body.date,
      weight: body.weight,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
      water: body.water,
      meal_quality: body.meal_quality,
      nutrition_notes: body.nutrition_notes,
      hrv: body.hrv,
      rhr: body.rhr,
      sleep_hours: body.sleep_hours,
      sleep_quality: body.sleep_quality,
      whoop_recovery: body.whoop_recovery,
      whoop_strain: body.whoop_strain,
      soreness: body.soreness,
      recovery_notes: body.recovery_notes,
      nutrition_output: nutrition,
      recovery_output: recovery,
      central_output: central,
    }, { onConflict: 'date' })

    if (error) throw error

    return NextResponse.json({ nutrition, recovery, central, flags })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
