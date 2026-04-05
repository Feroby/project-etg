import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Only fetch what strength coach actually needs — no daily_logs
    const [{ data: settings }, { data: sessions }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('strength_sessions').select('*').order('date', { ascending: true }).limit(10),
    ])

    const msg = `Session: ${body.day_type} | Duration: ${body.duration}min | Feel: "${body.feel}"
${body.session_detail}
Notes: "${body.session_notes || 'none'}"`

    const coachOutput = await runCoachChat(
      'strength', [{ role: 'user', content: msg }],
      settings, [], sessions || []
    )

    // Upsert so re-logging same date/day doesn't create duplicates
    const { data: existing } = await supabase
      .from('strength_sessions')
      .select('id')
      .eq('date', body.date)
      .eq('day_type', body.day_type)
      .single()

    let sessionId: string | null = null
    if (existing?.id) {
      await supabase.from('strength_sessions').update({
        week_number: body.week_number || 1,
        rpe: body.rpe, duration: body.duration, feel: body.feel,
        session_detail: body.session_detail, session_notes: body.session_notes,
        coach_output: coachOutput,
      }).eq('id', existing.id)
      sessionId = existing.id
    } else {
      const { data: inserted } = await supabase.from('strength_sessions').insert({
        date: body.date, week_number: body.week_number || 1, day_type: body.day_type,
        rpe: body.rpe, duration: body.duration, feel: body.feel,
        session_detail: body.session_detail, session_notes: body.session_notes,
        coach_output: coachOutput,
      }).select('id').single()
      sessionId = inserted?.id ?? null
    }

    return NextResponse.json({ output: coachOutput, id: sessionId })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
