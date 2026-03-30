import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase
    .from('api_usage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  return NextResponse.json({ usage: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { coach, input_tokens, output_tokens } = body

  // Claude Sonnet pricing (per million tokens)
  const INPUT_COST_PER_M = 3.0
  const OUTPUT_COST_PER_M = 15.0

  const input_cost = (input_tokens / 1_000_000) * INPUT_COST_PER_M
  const output_cost = (output_tokens / 1_000_000) * OUTPUT_COST_PER_M
  const total_cost = input_cost + output_cost

  const { error } = await supabase.from('api_usage').insert({
    coach,
    input_tokens,
    output_tokens,
    total_tokens: input_tokens + output_tokens,
    estimated_cost_usd: total_cost,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, estimated_cost_usd: total_cost })
}
