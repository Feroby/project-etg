import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { coach, messages } = await req.json()

    const { data: settings } = await supabase.from('settings').select('*').single()
    const { data: logs } = await supabase
      .from('daily_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(14)
    const { data: sessions } = await supabase
      .from('strength_sessions')
      .select('*')
      .order('date', { ascending: false })
      .limit(10)

    const reply = await runCoachChat(
      coach,
      messages,
      settings,
      (logs || []).reverse(),
      (sessions || []).reverse()
    )

    // Save messages to DB
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
