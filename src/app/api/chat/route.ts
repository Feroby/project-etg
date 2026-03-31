import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { coach, messages } = await req.json()

    const [{ data: settings }, { data: logsRaw }, { data: sessionsRaw }, { data: setsRaw }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(14),
      supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
      supabase.from('session_sets').select('*').order('set_number', { ascending: true }),
    ])

    const logs = (logsRaw || []).reverse()
    const sessions = (sessionsRaw || []).reverse()

    // Group sets by session_id
    const sessionSets: Record<string, any[]> = {}
    ;(setsRaw || []).forEach(set => {
      if (!sessionSets[set.session_id]) sessionSets[set.session_id] = []
      sessionSets[set.session_id].push(set)
    })

    const reply = await runCoachChat(
      coach,
      messages,
      settings,
      logs,
      sessions,
      { sessionSets }
    )

    // Save to DB
    const lastUser = messages[messages.length - 1]
    await supabase.from('chat_messages').insert([
      { coach, role: 'user', content: lastUser.content },
      { coach, role: 'assistant', content: reply },
    ])

    return NextResponse.json({ reply })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
