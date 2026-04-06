import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Coach = 'nutrition' | 'recovery' | 'strength' | 'central'

// Fire-and-forget usage tracking — never blocks a response
function trackUsage(coach: Coach, inputTokens: number, outputTokens: number): void {
  const cost = (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0
  Promise.resolve(
    supabase.from('api_usage').insert({
      coach, input_tokens: inputTokens, output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens, estimated_cost_usd: cost,
    })
  ).catch((e: any) => console.error('Usage tracking failed:', e))
}

function buildSettingsBlock(settings: any): string {
  if (!settings) return 'ATHLETE SETTINGS: Not configured yet.'
  return `ATHLETE SETTINGS & TARGETS:
- Goal weight: ${settings.goal_weight ?? 'not set'}kg | Current: ${settings.current_weight ?? 'not set'}kg | By: ${settings.target_date ?? 'not set'}
- Calories: ${settings.daily_calories ?? 'not set'}kcal | Protein: ${settings.daily_protein ?? 'not set'}g | Carbs: ${settings.daily_carbs ?? 'not set'}g | Fat: ${settings.daily_fat ?? 'not set'}g | Water: ${settings.daily_water ?? 'not set'}L
- HRV baseline: ${settings.hrv_baseline ?? 'not set'}ms | Min: ${settings.hrv_minimum ?? 'not set'}ms | Sleep target: ${settings.sleep_target ?? 'not set'}hr
- Min Whoop recovery: ${settings.whoop_min_recovery ?? 'not set'}% | Max strain: ${settings.whoop_max_strain ?? 'not set'}
- Training: ${settings.training_days_per_week ?? 'not set'}x/week | Block: ${settings.current_block ?? 'not set'} | Goal: ${settings.training_goal ?? 'not set'}
- Background: ${settings.athlete_background ?? 'not set'}`
}

function getNutritionSystemPrompt(settings: any, recentLogs: any[]): string {
  const history = recentLogs.length > 0
    ? `RECENT NUTRITION (${recentLogs.length} days):\n${recentLogs.map((l, i) => `Day -${recentLogs.length - i}: W=${l.weight}kg Cal=${l.calories} P=${l.protein}g C=${l.carbs}g F=${l.fat}g H2O=${l.water}L Q="${l.meal_quality}"`).join('\n')}`
    : 'RECENT HISTORY: No logs yet.'
  return `You are Dr. Sarah Mitchell, PhD Sports Nutrition. Direct, data-driven, expert.

${buildSettingsBlock(settings)}

${history}

- Reference athlete targets directly when asked — goal weight, macros, calories etc are all above
- Flag: protein <1.6g/kg, calories >500 below target 2+ days, weight plateau >${settings?.weight_plateau_days || 10} days
- Log responses: 3-4 sentences max. Chat: as long as needed.`
}

function getRecoverySystemPrompt(settings: any, recentLogs: any[]): string {
  const history = recentLogs.length > 0
    ? `RECENT RECOVERY (${recentLogs.length} days):\n${recentLogs.map((l, i) => `Day -${recentLogs.length - i}: HRV=${l.hrv}ms RHR=${l.rhr}bpm Sleep=${l.sleep_hours}hr(q:${l.sleep_quality}/10) Rec=${l.whoop_recovery}% Strain=${l.whoop_strain} Soreness=${l.soreness}/10`).join('\n')}`
    : 'RECENT HISTORY: No logs yet.'
  return `You are Dr. James Hartley, PhD Exercise Physiology, HRV specialist. Direct, data-driven, expert.

${buildSettingsBlock(settings)}

${history}

CONTEXT: Trains 3-4x/week + BJJ 1x/week. Week 1 of 6-week squat reintroduction block.
- Flag: HRV <${settings?.hrv_minimum || 65}ms for ${settings?.hrv_flag_days || 3}+ days, strain >${settings?.whoop_max_strain || 15}, sleep <6hr, recovery <33%
- Log responses: 3-4 sentences max. Chat: as long as needed.`
}

function getStrengthSystemPrompt(settings: any, recentSessions: any[], sessionSets?: Record<string, any[]>): string {
  const history = recentSessions.length > 0 ? (() => {
    const lines = recentSessions.map((s, i) => {
      const sets = sessionSets?.[s.id] || []
      const seen: Record<string, boolean> = {}
      const exNames: string[] = []
      sets.forEach((st: any) => { if (!seen[st.exercise_name]) { seen[st.exercise_name] = true; exNames.push(st.exercise_name) } })
      const detail = exNames.length > 0
        ? exNames.map((ex: string) => `  ${ex}: ${sets.filter((st: any) => st.exercise_name === ex).map((st: any) => `${st.weight || '-'}kg x${st.reps || '-'} @RPE${st.rpe || '-'}`).join(', ')}`).join('\n')
        : `  ${s.session_detail || 'No set data'}`
      return `Session ${i + 1} (${s.date}): ${s.day_type} | Feel: "${s.feel}" | ${s.duration}min\n${detail}`
    })
    return `RECENT SESSIONS:\n${lines.join('\n\n')}`
  })() : 'RECENT HISTORY: No sessions yet.'

  return `You are Dr. Marcus Reid, PhD Exercise Science, CSCS. Direct, data-driven, expert programmer.

${buildSettingsBlock(settings)}

${history}

WEEK 1 PROGRAM: Day1-Lower: Squat 4x5@RPE6(~80-90kg), RDL 3x8, LegPress 3x10, LegCurl 3x10, DeadBug 3x10/side | Day2-Upper: Bench 5x3@RPE7-8(~90-92kg), IncDB 3x8, Row 4x6, FacePull 3x15, Tricep 3x12 | Day3-Lower: RDL 4x6@RPE6-7, GobletSq 3x8@RPE5, Lunges 3x8/leg, LegCurl 3x10 | Day4-Optional: Bench 4x5@RPE6-7, OHP 3x8, LatPull 3x10, Curl 3x12
6-WEEK ARC: Wk1-2 reintro RPE6, Wk3-4 build RPE7-8+deadlift, Wk5 peak, Wk6 deload
- Flag: RPE above prescribed, mobility issues, poor recovery
- Log responses: 4-5 sentences. Chat: as long as needed.`
}

function getCentralSystemPrompt(settings: any, recentLogs: any[], recentSessions: any[]): string {
  const nutri = recentLogs.slice(-5).map(l => `${l.date}: Cal=${l.calories} P=${l.protein}g W=${l.weight}kg`).join('\n')
  const rec = recentLogs.slice(-5).map(l => `${l.date}: HRV=${l.hrv}ms Sleep=${l.sleep_hours}hr Rec=${l.whoop_recovery}%`).join('\n')
  const str = recentSessions.slice(-4).map(s => `${s.date}: ${s.day_type} Feel="${s.feel}"`).join('\n')
  const lastLog = recentLogs[recentLogs.length - 1]
  const lastSession = recentSessions[recentSessions.length - 1]
  return `You are the Head Performance Coach. Final authority across nutrition, recovery, and strength.

${buildSettingsBlock(settings)}

NUTRITION (last 5d): ${nutri || 'none'}
RECOVERY (last 5d): ${rec || 'none'}
STRENGTH (last 4s): ${str || 'none'}
Latest nutrition coach: ${lastLog?.nutrition_output || 'none'}
Latest recovery coach: ${lastLog?.recovery_output || 'none'}
Latest strength coach: ${lastSession?.coach_output || 'none'}

- Synthesise cross-domain patterns — spot what individual coaches miss
- Issue 2-3 clear directives per synthesis
- Track goal weight progress and block milestones
- Flag: poor recovery + high volume + low calories, RPE drift + HRV decline, weight plateau`
}

export async function runCoachChat(
  coach: Coach,
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: any,
  recentLogs: any[],
  recentSessions: any[],
  extra?: { sessionSets?: Record<string, any[]> }
): Promise<string> {
  const isSingleLogMessage = messages.length === 1
  const maxTokens = isSingleLogMessage ? 500 : 1024

  let systemPrompt = ''
  switch (coach) {
    case 'nutrition': systemPrompt = getNutritionSystemPrompt(settings, recentLogs); break
    case 'recovery': systemPrompt = getRecoverySystemPrompt(settings, recentLogs); break
    case 'strength': systemPrompt = getStrengthSystemPrompt(settings, recentSessions, extra?.sessionSets); break
    case 'central': systemPrompt = getCentralSystemPrompt(settings, recentLogs, recentSessions); break
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.slice(-20),
  })

  trackUsage(coach, response.usage.input_tokens, response.usage.output_tokens)
  return response.content.map(b => b.type === 'text' ? b.text : '').join('')
}

export async function checkGuardrails(recentLogs: any[], settings: any): Promise<string[]> {
  const flags: string[] = []
  if (!settings || !recentLogs.length) return flags
  const latest = recentLogs[recentLogs.length - 1]

  const hrvDays = settings.hrv_flag_days || 3
  if (recentLogs.length >= hrvDays) {
    const allLow = recentLogs.slice(-hrvDays).every((l: any) => l.hrv && l.hrv < (settings.hrv_minimum || 65))
    if (allLow) flags.push(`⚠️ HRV suppression: below ${settings.hrv_minimum || 65}ms for ${hrvDays} consecutive days`)
  }
  if (latest?.whoop_strain >= (settings.whoop_max_strain || 15))
    flags.push(`⚠️ High strain: ${latest.whoop_strain} exceeds threshold ${settings.whoop_max_strain || 15}`)

  const pd = settings.weight_plateau_days || 10
  if (recentLogs.length >= pd) {
    const weights = recentLogs.slice(-pd).map((l: any) => l.weight).filter(Boolean)
    if (weights.length >= pd && Math.max(...weights) - Math.min(...weights) < 0.5)
      flags.push(`⚠️ Weight plateau: <0.5kg change over ${pd} days`)
  }
  if (latest?.protein && latest?.weight && latest.protein / latest.weight < 1.6)
    flags.push(`⚠️ Low protein: ${latest.protein}g = ${(latest.protein / latest.weight).toFixed(1)}g/kg`)

  return flags
}
