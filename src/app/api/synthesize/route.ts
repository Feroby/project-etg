import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function avg(arr: (number | null)[]): number | null {
  const v = arr.filter((x): x is number => x != null && !isNaN(x as number))
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}

function trend(arr: (number | null | undefined)[]): 'rising' | 'falling' | 'stable' | 'insufficient' {
  const v = arr.filter((x): x is number => x != null && !isNaN(x as number))
  if (v.length < 3) return 'insufficient'
  const n = v.length
  const sumX = (n * (n - 1)) / 2
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY = v.reduce((a, b) => a + b, 0)
  const sumXY = v.reduce((a, b, i) => a + b * i, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const pctSlope = (slope / (sumY / n)) * 100
  if (pctSlope > 1) return 'rising'
  if (pctSlope < -1) return 'falling'
  return 'stable'
}

function streak(arr: (number | null | undefined)[], threshold: number, direction: 'above' | 'below'): number {
  let count = 0
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] == null) break
    const pass = direction === 'above' ? arr[i]! >= threshold : arr[i]! <= threshold
    if (pass) count++; else break
  }
  return count
}

export async function POST(req: NextRequest) {
  try {
    const [
      { data: settings },
      { data: allLogs },
      { data: allSessions },
      { data: setsRaw },
      { data: existingDirectives },
      { data: prevSyntheses },
      { data: program },
      { data: recentChats },
    ] = await Promise.all([
      supabase.from('settings').select('*').single(),
      supabase.from('daily_logs').select('*').order('date', { ascending: true }).limit(60),
      supabase.from('strength_sessions').select('*').order('date', { ascending: true }).limit(30),
      supabase.from('session_sets').select('*').order('set_number', { ascending: true }),
      supabase.from('coach_directives').select('*').eq('active', true).order('created_at', { ascending: false }).limit(10),
      supabase.from('synthesis_history').select('overall_score, headline, snapshot_weight, snapshot_hrv, snapshot_avg_protein, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('training_program').select('*').eq('active', true).order('created_at', { ascending: false }).limit(1).single(),
      supabase.from('daily_logs').select('date, nutrition_output, recovery_output, central_output').order('date', { ascending: false }).limit(5),
    ])

    const logs = allLogs || []
    const sessions = allSessions || []

    const sessionSets: Record<string, any[]> = {}
    ;(setsRaw || []).forEach((st: any) => {
      if (!sessionSets[st.session_id]) sessionSets[st.session_id] = []
      sessionSets[st.session_id].push(st)
    })

    const last7  = logs.slice(-7)
    const last14 = logs.slice(-14)
    const last30 = logs.slice(-30)

    const agg = {
      weightNow:     logs[logs.length - 1]?.weight ?? null,
      weightWk1:     logs[0]?.weight ?? null,
      weightTrend7:  trend(last7.map(l => l.weight)),
      weightTrend30: trend(last30.map(l => l.weight)),
      avgProtein7:   avg(last7.map(l => l.protein)),
      avgProtein14:  avg(last14.map(l => l.protein)),
      avgCals7:      avg(last7.map(l => l.calories)),
      avgCals14:     avg(last14.map(l => l.calories)),
      avgWater7:     avg(last7.map(l => l.water != null ? Math.round(l.water * 10) / 10 : null)),
      daysUnderProtein:  last14.filter(l => l.protein && settings?.daily_protein && l.protein < settings.daily_protein * 0.9).length,
      daysUnderCalories: last14.filter(l => l.calories && settings?.daily_calories && l.calories < settings.daily_calories - 300).length,
      avgHrv7:        avg(last7.map(l => l.hrv)),
      avgHrv14:       avg(last14.map(l => l.hrv)),
      avgHrv30:       avg(last30.map(l => l.hrv)),
      hrvTrend7:      trend(last7.map(l => l.hrv)),
      hrvTrend14:     trend(last14.map(l => l.hrv)),
      avgSleep7:      avg(last7.map(l => l.sleep_hours != null ? Math.round(l.sleep_hours * 10) : null)),
      avgRecovery7:   avg(last7.map(l => l.whoop_recovery)),
      avgStrain7:     avg(last7.map(l => l.whoop_strain)),
      lowHrvStreak:   streak(last14.map(l => l.hrv), settings?.hrv_minimum || 65, 'below'),
      highStrainDays: last7.filter(l => l.whoop_strain && l.whoop_strain > (settings?.whoop_max_strain || 15)).length,
      sessionsThisBlock: sessions.length,
      avgRpe7: avg(sessions.slice(-4).map(s => s.rpe)),

      // Barbell flat bench only — exclude incline, DB, cable
      benchProgression: (() => {
        const pts: { date: string; weight: number }[] = []
        sessions.forEach(s => {
          const sets = (sessionSets[s.id] || []).filter((st: any) => {
            const name = (st.exercise_name || '').toLowerCase()
            return name.includes('bench') &&
              !name.includes('incline') && !name.includes('decline') &&
              !name.includes('db') && !name.includes('dumbbell') &&
              st.weight
          })
          if (sets.length) pts.push({ date: s.date, weight: Math.max(...sets.map((st: any) => st.weight)) })
        })
        return pts.slice(-5)
      })(),

      // Barbell back squat only — explicitly exclude goblet, split, Bulgarian, front squat
      squatProgression: (() => {
        const pts: { date: string; weight: number }[] = []
        sessions.forEach(s => {
          const sets = (sessionSets[s.id] || []).filter((st: any) => {
            const name = (st.exercise_name || '').toLowerCase()
            const isBackSquat = (
              name.includes('back squat') ||
              name.includes('low bar') ||
              name.includes('high bar') ||
              (name.includes('barbell') && name.includes('squat'))
            ) && !name.includes('goblet') && !name.includes('split') &&
              !name.includes('bulgarian') && !name.includes('front')
            return isBackSquat && st.weight
          })
          if (sets.length) pts.push({ date: s.date, weight: Math.max(...sets.map((st: any) => st.weight)) })
        })
        return pts.slice(-5)
      })(),
    }

    const detailBlock = last7.map(l => {
      const parts = [`${l.date}: W=${l.weight ?? '—'}kg Cal=${l.calories ?? '—'} P=${l.protein ?? '—'}g HRV=${l.hrv ?? '—'}ms Rec=${l.whoop_recovery ?? '—'}% Sleep=${l.sleep_hours ?? '—'}hr Strain=${l.whoop_strain ?? '—'} Soreness=${l.soreness ?? '—'}/10`]
      if (l.food_items) parts.push(`  Foods: ${l.food_items}`)
      if (l.nutrition_notes || l.recovery_notes) parts.push(`  Notes: ${[l.nutrition_notes, l.recovery_notes].filter(Boolean).join(' | ')}`)
      return parts.join('\n')
    }).join('\n')

    const strengthDetail = sessions.slice(-6).map(s => {
      const sets = sessionSets[s.id] || []
      const exNames = Array.from(new Set(sets.map((st: any) => st.exercise_name as string)))
      const detail = exNames.length
        ? exNames.map(ex => `  ${ex}: ${sets.filter((st: any) => st.exercise_name === ex).map((st: any) => `${st.weight ?? '-'}kg×${st.reps ?? '-'}@RPE${st.rpe ?? '-'}`).join(', ')}`).join('\n')
        : `  ${s.session_detail || 'No set data'}`
      return `${s.date} ${s.day_type} (Wk${s.week_number}) Feel="${s.feel ?? '—'}" ${s.duration ?? '—'}min\n${detail}`
    }).join('\n\n')

    const coachThread = (recentChats || []).filter(l => l.nutrition_output || l.recovery_output).slice(0, 3).map(l =>
      `${l.date}:\n` +
      (l.nutrition_output ? `  Nutrition: ${l.nutrition_output.slice(0, 200)}…\n` : '') +
      (l.recovery_output  ? `  Recovery: ${l.recovery_output.slice(0, 200)}…\n`  : '')
    ).join('\n')

    const synthThread = (prevSyntheses || []).length
      ? `SYNTHESIS HISTORY:\n${(prevSyntheses || []).map(s =>
          `${(s.created_at as string).slice(0, 10)}: Score=${s.overall_score}/10 Weight=${s.snapshot_weight}kg HRV=${s.snapshot_hrv}ms AvgProtein=${s.snapshot_avg_protein}g | "${s.headline}"`
        ).join('\n')}`
      : 'No previous syntheses.'

    const programCtx = program
      ? `Block: ${program.block_name} | Week ${program.week_number}/${program.total_weeks} | Goal: ${program.goal}`
      : 'No active program.'

    const directivesCtx = (existingDirectives || []).length
      ? `ACTIVE DIRECTIVES:\n${(existingDirectives || []).map(d => `[${d.target_coach.toUpperCase()}][${d.priority}] ${d.directive}`).join('\n')}`
      : 'No active directives.'

    const settingsBlock = settings
      ? `Goal: ${settings.goal_weight}kg (from ${settings.current_weight}kg) by ${settings.target_date} | Cals: ${settings.daily_calories}kcal | P: ${settings.daily_protein}g | HRV baseline: ${settings.hrv_baseline}ms (min: ${settings.hrv_minimum}ms) | Sleep: ${settings.sleep_target}hr | Block goal: ${settings.training_goal}`
      : 'Settings not configured.'

    const today = new Date().toISOString().slice(0, 10)

    const prompt = `You are the Head Performance Coach for a 1.86m ~95kg male athlete targeting muscle gain.

TODAY'S DATE: ${today}
GOALS & SETTINGS: ${settingsBlock}
TRAINING PROGRAM: ${programCtx}

AGGREGATED METRICS:
- Weight: now=${agg.weightNow}kg start=${agg.weightWk1}kg | 7d trend=${agg.weightTrend7} 30d trend=${agg.weightTrend30}
- Nutrition 7d avg: ${agg.avgCals7}kcal / ${agg.avgProtein7}g protein / ${agg.avgWater7}L water
- Nutrition 14d avg: ${agg.avgCals14}kcal / ${agg.avgProtein14}g protein
- Days under protein target (14d): ${agg.daysUnderProtein} | Days under calorie target (14d): ${agg.daysUnderCalories}
- HRV 7d avg: ${agg.avgHrv7}ms | 14d avg: ${agg.avgHrv14}ms | 30d avg: ${agg.avgHrv30}ms | 7d trend: ${agg.hrvTrend7} | 14d trend: ${agg.hrvTrend14}
- Sleep 7d avg: ${agg.avgSleep7 ? (agg.avgSleep7 / 10).toFixed(1) : '—'}hr | Whoop recovery 7d avg: ${agg.avgRecovery7}%
- Consecutive days HRV below minimum: ${agg.lowHrvStreak}
- High strain days (last 7d): ${agg.highStrainDays}
- Strength sessions this block: ${agg.sessionsThisBlock} | Avg RPE (last 4): ${agg.avgRpe7}
- Barbell bench press progression: ${agg.benchProgression.map(p => `${p.date.slice(5)}: ${p.weight}kg`).join(' → ') || 'no data'}
- Barbell back squat progression (goblet/split/front squat excluded): ${agg.squatProgression.map(p => `${p.date.slice(5)}: ${p.weight}kg`).join(' → ') || 'no data'}

LAST 7 DAYS:
${detailBlock || 'No data'}

STRENGTH SESSIONS (last 6):
${strengthDetail || 'No sessions'}

SPECIALIST COACH THREAD:
${coachThread || 'No recent outputs'}

${synthThread}

${directivesCtx}

STRENGTH ANALYSIS RULES: Only compare like-for-like barbell movements. Goblet squat, Bulgarian split squat, walking lunges, leg press are accessory movements — their loads have no relationship to barbell back squat. Incline DB press loads are not comparable to flat barbell bench. Never infer back squat strength from goblet squat or any other variant.

Your job: spot what specialist coaches miss. They see individual days. You see the full arc.

Return ONLY valid JSON, no markdown fences:
{
  "period": "<date range>",
  "overall_score": <1-10>,
  "headline": "<1 punchy sentence>",
  "domains": {
    "nutrition": { "score": <1-10>, "status": "on_track"|"attention"|"critical", "summary": "<2-3 sentences with trend context>", "key_wins": ["<win>"], "flags": ["<concern>"] },
    "recovery":  { "score": <1-10>, "status": "on_track"|"attention"|"critical", "summary": "<2-3 sentences>", "key_wins": ["<win>"], "flags": ["<concern>"] },
    "strength":  { "score": <1-10>, "status": "on_track"|"attention"|"critical", "summary": "<2-3 sentences>", "key_wins": ["<win>"], "flags": ["<concern>"] }
  },
  "cross_domain_insights": ["<insight with specific numbers>", "<insight>", "<insight>"],
  "goal_trajectory": "<1-2 sentences on weight target progress>",
  "blind_spots": ["<pattern athlete is not seeing>", "<blind spot if warranted>"],
  "directives": [
    { "priority": "high"|"medium", "action": "<specific instruction>", "domain": "nutrition"|"recovery"|"strength"|"all" }
  ],
  "coach_notes": {
    "nutrition": "<standing instruction for Dr. Mitchell>",
    "recovery":  "<standing instruction for Dr. Hartley>",
    "strength":  "<standing instruction for Dr. Reid>"
  },
  "next_checkpoint": "<what to watch in next 7 days>"
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim()
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const report = JSON.parse(cleaned)

    const coachKeys = ['nutrition', 'recovery', 'strength'] as const
    await supabase.from('coach_directives').update({ active: false }).eq('active', true).eq('source', 'central')
    if (report.coach_notes) {
      const toInsert = coachKeys
        .filter(c => report.coach_notes[c]?.trim())
        .map(c => ({ target_coach: c, directive: report.coach_notes[c].trim(), priority: 'medium' as const, source: 'central', active: true }))
      if (toInsert.length) await supabase.from('coach_directives').insert(toInsert)
    }

    const latestLog = logs[logs.length - 1]
    Promise.resolve(
      supabase.from('synthesis_history').insert({
        period_days: 7, overall_score: report.overall_score, headline: report.headline,
        snapshot_weight: latestLog?.weight ?? null, snapshot_hrv: latestLog?.hrv ?? null,
        snapshot_avg_protein: agg.avgProtein7, snapshot_avg_calories: agg.avgCals7,
        snapshot_avg_sleep: agg.avgSleep7 ? agg.avgSleep7 / 10 : null,
        snapshot_whoop_recovery: agg.avgRecovery7, report, prior_directives: existingDirectives || [],
      })
    ).catch(() => {})

    Promise.resolve(
      supabase.from('api_usage').insert({
        coach: 'central', input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        estimated_cost_usd: (response.usage.input_tokens / 1_000_000) * 3.0 + (response.usage.output_tokens / 1_000_000) * 15.0,
      })
    ).catch(() => {})

    const { data: newDirectives } = await supabase.from('coach_directives').select('*').eq('active', true).order('target_coach')
    return NextResponse.json({ report, generatedAt: new Date().toISOString(), directives: newDirectives || [] })

  } catch (e: any) {
    console.error('Synthesize error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
