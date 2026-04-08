import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { days = 3 } = await req.json()

    const [{ data: settings }, { data: logs }, { data: sessions }, { data: setsRaw }, { data: existingDirectives }] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(days),
      supabase.from('strength_sessions').select('*').order('date', { ascending: false }).limit(days * 2),
      supabase.from('session_sets').select('*').order('set_number', { ascending: true }),
      supabase.from('coach_directives').select('*').eq('active', true).order('created_at', { ascending: false }).limit(20),
    ])

    const recentLogs = (logs || []).reverse()
    const recentSessions = (sessions || []).reverse()

    const sessionSets: Record<string, any[]> = {}
    ;(setsRaw || []).forEach((st: any) => {
      if (!sessionSets[st.session_id]) sessionSets[st.session_id] = []
      sessionSets[st.session_id].push(st)
    })

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

    const currentDirectivesBlock = (existingDirectives || []).length > 0
      ? `\nCURRENTLY ACTIVE DIRECTIVES (from previous synthesis):\n${(existingDirectives || []).map(d => `[${d.target_coach.toUpperCase()}][${d.priority}] ${d.directive}`).join('\n')}`
      : '\nNo active directives from previous synthesis.'

    const prompt = `You are the Head Performance Coach synthesising ${days} day(s) of athlete data. Produce a structured JSON report AND issue directives to your specialist coaches. Return ONLY valid JSON, no markdown fences.

ATHLETE SETTINGS:
${settingsBlock}

NUTRITION DATA (${days}d):
${nutritionBlock || 'No nutrition data'}

RECOVERY DATA (${days}d):
${recoveryBlock || 'No recovery data'}

STRENGTH DATA (${days}d):
${strengthBlock || 'No strength data'}
${currentDirectivesBlock}

Return this exact JSON structure:
{
  "period": "<e.g. 'Last 3 days: Apr 3–5'>",
  "overall_score": <1-10 integer>,
  "headline": "<1 sentence punchy summary of overall athlete status>",
  "domains": {
    "nutrition": {
      "score": <1-10>,
      "status": "on_track" | "attention" | "critical",
      "summary": "<2-3 sentences with specific numbers>",
      "key_wins": ["<specific win>"],
      "flags": ["<specific concern with numbers>"]
    },
    "recovery": {
      "score": <1-10>,
      "status": "on_track" | "attention" | "critical",
      "summary": "<2-3 sentences with specific numbers>",
      "key_wins": ["<specific win>"],
      "flags": ["<specific concern with numbers>"]
    },
    "strength": {
      "score": <1-10>,
      "status": "on_track" | "attention" | "critical",
      "summary": "<2-3 sentences with specific numbers>",
      "key_wins": ["<specific win>"],
      "flags": ["<specific concern with numbers>"]
    }
  },
  "cross_domain_insights": [
    "<insight connecting 2+ domains with specific data>",
    "<insight>",
    "<insight if warranted>"
  ],
  "directives": [
    { "priority": "high" | "medium", "action": "<directive shown to athlete>", "domain": "nutrition" | "recovery" | "strength" | "all" }
  ],
  "coach_notes": {
    "nutrition": "<standing instruction for Dr. Mitchell — what to watch for, emphasise, or push back on in upcoming logs/chats. Be specific. E.g: 'Athlete is under-eating protein consistently. Challenge every log where protein <180g. Suggest specific high-protein food swaps. Do not accept <160g without flagging.'>",
    "recovery": "<standing instruction for Dr. Hartley — what patterns to monitor, thresholds to enforce, or adjustments to make. E.g: 'HRV trending down. Flag any session where strain >10 until HRV recovers above baseline. Push back on training on days with recovery <40%.'>",
    "strength": "<standing instruction for Dr. Reid — programming adjustments, load guidance, technique flags to watch. E.g: 'Squat reintroduction going well. Athlete can progress load by 2.5kg per session next week if RPE stays at 6. Flag any squat RPE above 7.5 this week.'>"
  },
  "next_checkpoint": "<what to monitor next>"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim()
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const report = JSON.parse(cleaned)

    // Save directives to DB — deactivate old ones first, then insert new
    const coaches: Array<'nutrition' | 'recovery' | 'strength'> = ['nutrition', 'recovery', 'strength']
    await supabase.from('coach_directives').update({ active: false }).eq('active', true).eq('source', 'central')

    if (report.coach_notes) {
      const toInsert = coaches
        .filter(c => report.coach_notes[c] && report.coach_notes[c].trim())
        .map(c => ({
          target_coach: c,
          directive: report.coach_notes[c].trim(),
          priority: 'medium' as const,
          source: 'central',
          active: true,
        }))
      if (toInsert.length > 0) {
        await supabase.from('coach_directives').insert(toInsert)
      }
    }

    // Track usage
    Promise.resolve(
      supabase.from('api_usage').insert({
        coach: 'central', input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        estimated_cost_usd: (response.usage.input_tokens / 1_000_000) * 3.0 + (response.usage.output_tokens / 1_000_000) * 15.0,
      })
    ).catch(() => {})

    // Fetch the newly saved directives to return to UI
    const { data: newDirectives } = await supabase.from('coach_directives').select('*').eq('active', true).order('target_coach')

    return NextResponse.json({ report, generatedAt: new Date().toISOString(), directives: newDirectives || [] })
  } catch (e: any) {
    console.error('Synthesize error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
