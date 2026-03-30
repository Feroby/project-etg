import { NextRequest, NextResponse } from 'next/server'
import { runStrengthPipeline } from '@/lib/coaches'
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
      .order('date', { ascending: true })
      .limit(10)

    const coachOutput = await runStrengthPipeline(body, settings, logs || [], sessions || [])

    const { error } = await supabase.from('strength_sessions').insert({
      date: body.date,
      week_number: body.week_number || 1,
      day_type: body.day_type,
      rpe: body.rpe,
      duration: body.duration,
      feel: body.feel,
      session_detail: body.session_detail,
      session_notes: body.session_notes,
      coach_output: coachOutput,
    })

    if (error) throw error

    return NextResponse.json({ output: coachOutput })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
