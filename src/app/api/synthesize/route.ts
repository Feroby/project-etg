import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { days = 3 } = await req.json()

    // Fetch everything needed in parallel
    const [{ data: settings }, { data: logs }, { data: sessions }, { data: setsRaw }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(days),
      supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(days * 2),
      supabase.from('session_sets').select('*').order('set_number', { ascending: true }),
    ])

    const recentLogs = (logs || []).reverse()
    const recentSessions = (sessions || []).reverse()

    // Group sets by session
    const sessionSets: Record<string, any[]> = {}
    ;(setsRaw || []).forEach((st: any) => {
      if (!sessionSets[st.session_id]) sessionSets[st.session_id] = []
      sessionSets[st.session_id].push(st)
    })

    // Build rich data block
    const nutritionBlock = recentLogs.map(l => {
      const lines = [`${l.date}: Cal=${l.calories ?? '—'} P=${l.protein ?? '—'}g C=${l.carbs ?? '—'}g F=${l.fat ?? '—'}g Water=${l.water ?? '—'}L Weight=${l.weight ?? '—'}kg Quality="${l.meal_quality ?? '—'}"`]
      if (l.food_items) lines.push(`  Foods: ${l.food_items}`)
      if (l.nutrition_notes) lines.push(`  Notes: ${l.nutrition_notes}`)
      return lines.join('\n')
    }).join('\n')

    const recoveryBlock = recentLogs.map(l =>
      `${l.date}: HRV=${l.hrv ?? '—'}ms RHR=${l.rhr ?? '—'}bpm Sleep=${l.sleep_hours ?? '—'}hr(q:${l.sleep_quality ?? '—'}/10) WhoopRec=${l.whoop_recovery ?? '—'}% Strain=${l.whoop_strain ?? '—'} Soreness=${l.soreness ?? '—'}/10${l.recovery_notes ? ` Notes: ${l.recovery_notes}` : ''}`
    ).join('\n')

    const strengthBlock = recentSessions.map(s => {
      const sets = sessionSets[s.id] || []
      const seen: Record<string, boolean> = {}
      const exNames: string[] = []
      sets.forEach((st: any) => { if (!seen[st.exercise_name]) { seen[st.exercise_name] = true; exNames.push(st.exercise_name) } })
      const detail = exNames.length > 0
        ? exNames.map((ex: string) => `  ${ex}: ${sets.filter((st: any) => st.exercise_name === ex).map((st: any) => `${st.weight ?? '-'}kg×${st.reps ?? '-'}@RPE${st.rpe ?? '-'}`).join(', ')}`).join('\n')
        : (s.session_detail ? `  ${s.session_detail}` : '  No set data')
      return `${s.date}: ${s.day_type} | Feel="${s.feel ?? '—'}" | ${s.duration ?? '—'}min\n${detail}`
    }).join('\n\n')

    const settingsBlock = settings ? `Goal weight: ${settings.goal_weight}kg (current: ${settings.current_weight}kg) | Target: ${settings.target_date}
Calories: ${settings.daily_calories}kcal | P: ${settings.daily_protein}g | C: ${settings.daily_carbs}g | F: ${settings.daily_fat}g
HRV baseline: ${settings.hrv_baseline}ms | Min: ${settings.hrv_minimum}ms | Sleep target: ${settings.sleep_target}hr
Training: ${settings.current_block} | Goal: ${settings.training_goal}` : 'Settings not configured'

    const prompt = `You are the Head Performance Coach synthesising ${days} day(s) of athlete data. Produce a structured JSON report. Return ONLY valid JSON, no markdown fences.

ATHLETE SETTINGS:
${settingsBlock}

NUTRITION DATA (${days}d):
${nutritionBlock || 'No nutrition data'}

RECOVERY DATA (${days}d):
${recoveryBlock || 'No recovery data'}

STRENGTH DATA (${days}d):
${strengthBlock || 'No strength data'}

Return this exact JSON structure:
{
  "period": "<e.g. 'Last 3 days: Apr 3–5'>",
  "overall_score": <1-10 integer>,
  "headline": "<1 sentence punchy summary of how the athlete is doing overall>",
  "domains": {
    "nutrition": {
      "score": <1-10>,
      "status": "on_track" | "attention" | "critical",
      "summary": "<2-3 sentences: what's working, what needs fixing, specific numbers>",
      "key_wins": ["<specific win>"],
      "flags": ["<specific concern with numbers>"]
    },
    "recovery": {
      "score": <1-10>,
      "status": "on_track" | "attention" | "critical",
      "summary": "<2-3 sentences: HRV trend, sleep, readiness assessment>",
      "key_wins": ["<specific win>"],
      "flags": ["<specific concern with numbers>"]
    },
    "strength": {
      "score": <1-10>,
      "status": "on_track" | "attention" | "critical",
      "summary": "<2-3 sentences: session quality, load vs prescription, progression notes>",
      "key_wins": ["<specific win>"],
      "flags": ["<specific concern with numbers>"]
    }
  },
  "cross_domain_insights": [
    "<insight that connects 2+ domains e.g. 'Low protein on rest days correlating with HRV dip'>",
    "<insight>",
    "<insight if warranted>"
  ],
  "directives": [
    { "priority": "high" | "medium", "action": "<specific actionable directive>", "domain": "nutrition" | "recovery" | "strength" | "all" },
    { "priority": "high" | "medium", "action": "<directive>", "domain": "..." },
    { "priority": "high" | "medium", "action": "<directive>", "domain": "..." }
  ],
  "next_checkpoint": "<what to look for / measure next>"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim()
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const report = JSON.parse(cleaned)

    // Save to DB async — don't block
    if (recentLogs.length > 0) {
      const latest = recentLogs[recentLogs.length - 1]
      Promise.resolve(
        supabase.from('daily_logs').update({ central_output: report.headline + '\n\n' + report.domains.nutrition.summary + '\n\n' + report.domains.recovery.summary }).eq('date', latest.date)
      ).catch(() => {})
    }

    // Track usage
    Promise.resolve(
      supabase.from('api_usage').insert({
        coach: 'central', input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        estimated_cost_usd: (response.usage.input_tokens / 1_000_000) * 3.0 + (response.usage.output_tokens / 1_000_000) * 15.0,
      })
    ).catch(() => {})

    return NextResponse.json({ report, generatedAt: new Date().toISOString() })
  } catch (e: any) {
    console.error('Synthesize error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
