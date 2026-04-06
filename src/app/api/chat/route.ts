import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { coach, messages } = await req.json()

    const fetchSets = coach === 'strength'
    const [{ data: settings }, { data: logsRaw }, { data: sessionsRaw }, setsResult] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(14),
      supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
      fetchSets
        ? supabase.from('session_sets').select('*').order('set_number', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    const logs = (logsRaw || []).reverse()
    const sessions = (sessionsRaw || []).reverse()

    const sessionSets: Record<string, any[]> = {}
    ;(setsResult.data || []).forEach((set: any) => {
      if (!sessionSets[set.session_id]) sessionSets[set.session_id] = []
      sessionSets[set.session_id].push(set)
    })

    const reply = await runCoachChat(coach, messages, settings, logs, sessions, { sessionSets })

    // Fire-and-forget — wrap in Promise.resolve so .catch() is available on all TS targets
    const lastUser = messages[messages.length - 1]
    Promise.resolve(
      supabase.from('chat_messages').insert([
        { coach, role: 'user', content: lastUser.content },
        { coach, role: 'assistant', content: reply },
      ])
    ).catch((e: any) => console.error('Chat save failed:', e))

    return NextResponse.json({ reply })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
