import { NextRequest, NextResponse } from 'next/server'
import { runCoachChat } from '@/lib/coaches'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { coach, messages } = await req.json()

    const fetchSets = coach === 'strength'
    const [{ data: settings }, { data: logsRaw }, { data: sessionsRaw }, setsResult, programResult] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(14),
      supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(10),
      fetchSets
        ? supabase.from('session_sets').select('*').order('set_number', { ascending: true })
        : Promise.resolve({ data: [] }),
      fetchSets
        ? supabase.from('training_program').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).single()
        : Promise.resolve({ data: null }),
    ])

    const logs = (logsRaw || []).reverse()
    const sessions = (sessionsRaw || []).reverse()

    const sessionSets: Record<string, any[]> = {}
    ;(setsResult.data || []).forEach((set: any) => {
      if (!sessionSets[set.session_id]) sessionSets[set.session_id] = []
      sessionSets[set.session_id].push(set)
    })

    const currentProgram = (programResult as any)?.data || null

    const reply = await runCoachChat(
      coach, messages, settings, logs, sessions,
      { sessionSets, currentProgram }
    )

    // Detect and apply program updates embedded in the reply
    // Format: [PROGRAM_UPDATE]{"sessions": [...], "week_number": 2, "coach_notes": "..."}[/PROGRAM_UPDATE]
    const programUpdateMatch = reply.match(/\[PROGRAM_UPDATE\]([\s\S]*?)\[\/PROGRAM_UPDATE\]/)
    let cleanReply = reply
    let programUpdated = false

    if (programUpdateMatch && coach === 'strength') {
      try {
        const updateData = JSON.parse(programUpdateMatch[1].trim())
        const updatePayload: any = { updated_at: new Date().toISOString() }
        if (updateData.sessions) updatePayload.sessions = updateData.sessions
        if (updateData.week_number) updatePayload.week_number = updateData.week_number
        if (updateData.coach_notes) updatePayload.coach_notes = updateData.coach_notes
        if (updateData.block_name) updatePayload.block_name = updateData.block_name

        await supabase.from('training_program').update(updatePayload).eq('active', true)
        programUpdated = true

        // Remove the update block from the displayed reply
        cleanReply = reply.replace(/\[PROGRAM_UPDATE\][\s\S]*?\[\/PROGRAM_UPDATE\]/g, '').trim()
      } catch (e) {
        console.error('Program update parse failed:', e)
        cleanReply = reply.replace(/\[PROGRAM_UPDATE\][\s\S]*?\[\/PROGRAM_UPDATE\]/g, '').trim()
      }
    }

    // Save messages (use clean reply without update block)
    const lastUser = messages[messages.length - 1]
    Promise.resolve(
      supabase.from('chat_messages').insert([
        { coach, role: 'user', content: lastUser.content },
        { coach, role: 'assistant', content: cleanReply },
      ])
    ).catch((e: any) => console.error('Chat save failed:', e))

    return NextResponse.json({ reply: cleanReply, programUpdated })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
