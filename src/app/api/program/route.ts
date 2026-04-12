import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET — fetch the active program
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('training_program')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    return NextResponse.json({ program: data || null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — update program fields (called by chat route after AI edit)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    // Always bump updated_at
    updates.updated_at = new Date().toISOString()

    const { data, error } = id
      ? await supabase.from('training_program').update(updates).eq('id', id).select().single()
      : await supabase.from('training_program').update(updates).eq('active', true).select().single()

    if (error) throw error
    return NextResponse.json({ program: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
