import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Coach = 'nutrition' | 'recovery' | 'strength' | 'central'

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

function buildDirectivesBlock(directives: any[]): string {
  if (!directives || directives.length === 0) return ''
  const sorted = [...directives].sort((a, b) => (a.priority === 'high' ? -1 : 1))
  return `\nDIRECTIVES FROM HEAD COACH (follow these — they override your defaults):
${sorted.map(d => `[${d.priority.toUpperCase()}] ${d.directive}`).join('\n')}`
}

function buildProgramBlock(program: any): string {
  if (!program) return 'CURRENT PROGRAM: Not yet loaded from database.'
  const sessions = Array.isArray(program.sessions) ? program.sessions : JSON.parse(program.sessions || '[]')
  const sessionText = sessions.map((s: any) => {
    const exLines = (s.exercises || []).map((e: any) =>
      `    - ${e.name}: ${e.sets}×${e.reps} @RPE${e.rpe}${e.load_notes ? ` (${e.load_notes})` : ''}${e.technique_notes ? ` [${e.technique_notes}]` : ''}`
    ).join('\n')
    return `  ${s.name}${s.optional ? ' [OPTIONAL]' : ''}:\n${exLines}`
  }).join('\n\n')
  return `CURRENT TRAINING PROGRAM:
Block: ${program.block_name} (Week ${program.week_number}/${program.total_weeks})
Goal: ${program.goal || 'not set'}
Coach notes: ${program.coach_notes || 'none'}

Sessions:
${sessionText}`
}

// Classifies an exercise name into primary or accessory category
function classifyExercise(name: string): 'primary_squat' | 'primary_bench' | 'primary_pull' | 'accessory' {
  const n = name.toLowerCase()
  // Primary squat variants (barbell, load-comparable)
  if ((n.includes('back squat') || n.includes('low bar') || n.includes('high bar') ||
      (n.includes('barbell') && n.includes('squat'))) &&
      !n.includes('goblet') && !n.includes('split') && !n.includes('bulgarian') && !n.includes('front')) {
    return 'primary_squat'
  }
  // Primary bench (flat barbell only)
  if (n.includes('bench') && !n.includes('incline') && !n.includes('decline') &&
      !n.includes('db') && !n.includes('dumbbell')) {
    return 'primary_bench'
  }
  // Primary pulls
  if (n.includes('deadlift') || (n.includes('barbell') && n.includes('row'))) {
    return 'primary_pull'
  }
  return 'accessory'
}

function getNutritionSystemPrompt(settings: any, recentLogs: any[], directives: any[] = []): string {
  const history = recentLogs.length > 0
    ? `RECENT NUTRITION (${recentLogs.length} days):\n${recentLogs.map((l, i) => {
        const base = `Day -${recentLogs.length - i}: W=${l.weight}kg Cal=${l.calories} P=${l.protein}g C=${l.carbs}g F=${l.fat}g H2O=${l.water}L Q="${l.meal_quality}"`
        return l.food_items ? `${base}\n  Foods: ${l.food_items}` : base
      }).join('\n')}`
    : 'RECENT HISTORY: No logs yet.'
  return `You are Dr. Sarah Mitchell, PhD Sports Nutrition. Direct, data-driven, expert.

${buildSettingsBlock(settings)}
${buildDirectivesBlock(directives)}
${history}

- Reference athlete targets directly when asked
- When food_items data is present: identify high/low protein sources, flag processed foods, suggest specific food swaps
- Flag: protein <1.6g/kg, calories >500 below target 2+ days, weight plateau >${settings?.weight_plateau_days || 10} days
- Log responses: 3-4 sentences max. Chat: as long as needed.`
}

function getRecoverySystemPrompt(settings: any, recentLogs: any[], directives: any[] = []): string {
  const history = recentLogs.length > 0
    ? `RECENT RECOVERY (${recentLogs.length} days):\n${recentLogs.map((l, i) =>
        `Day -${recentLogs.length - i}: HRV=${l.hrv}ms RHR=${l.rhr}bpm Sleep=${l.sleep_hours}hr(q:${l.sleep_quality}/10) Rec=${l.whoop_recovery}% Strain=${l.whoop_strain} Soreness=${l.soreness}/10`
      ).join('\n')}`
    : 'RECENT HISTORY: No logs yet.'
  return `You are Dr. James Hartley, PhD Exercise Physiology, HRV specialist. Direct, data-driven, expert.

${buildSettingsBlock(settings)}
${buildDirectivesBlock(directives)}
${history}

CONTEXT: Trains 3-4x/week + BJJ 1x/week. Squat reintroduction block.
- Flag: HRV <${settings?.hrv_minimum || 65}ms for ${settings?.hrv_flag_days || 3}+ days, strain >${settings?.whoop_max_strain || 15}, sleep <6hr, recovery <33%
- Log responses: 3-4 sentences max. Chat: as long as needed.`
}

function getStrengthSystemPrompt(
  settings: any,
  recentSessions: any[],
  directives: any[] = [],
  sessionSets?: Record<string, any[]>,
  currentProgram?: any
): string {
  // Build session history with exercises labelled by type
  const history = recentSessions.length > 0 ? (() => {
    const lines = recentSessions.map((s, i) => {
      const sets = sessionSets?.[s.id] || []
      const seen: Record<string, boolean> = {}
      const exNames: string[] = []
      sets.forEach((st: any) => {
        if (!seen[st.exercise_name]) { seen[st.exercise_name] = true; exNames.push(st.exercise_name) }
      })

      const detail = exNames.length > 0
        ? exNames.map((ex: string) => {
            const type = classifyExercise(ex)
            const tag = type === 'accessory' ? ' [ACCESSORY]' : ' [PRIMARY]'
            const setStr = sets
              .filter((st: any) => st.exercise_name === ex)
              .map((st: any) => `${st.weight || '-'}kg×${st.reps || '-'}@RPE${st.rpe || '-'}`)
              .join(', ')
            return `  ${ex}${tag}: ${setStr}`
          }).join('\n')
        : `  ${s.session_detail || 'No set data'}`

      return `Session ${i + 1} (${s.date}): ${s.day_type} | Feel: "${s.feel}" | ${s.duration}min\n${detail}`
    })
    return `RECENT SESSIONS:\n${lines.join('\n\n')}`
  })() : 'RECENT HISTORY: No sessions yet.'

  return `You are Dr. Marcus Reid, PhD Exercise Science, CSCS. Expert programmer for strength athletes and combat sports athletes. 20 years experience. Evidence-based: Prilepin, RPE/RIR methodology, NSCA guidelines, periodisation science.

${buildSettingsBlock(settings)}
${buildDirectivesBlock(directives)}

${buildProgramBlock(currentProgram)}

EXERCISE TAXONOMY — APPLY THIS EVERY TIME YOU ANALYSE SESSIONS:

PRIMARY BARBELL LIFTS — track progression, compare across sessions, use for load recommendations:
  • Back squat / Low bar squat / High bar squat (barbell) → TRUE squat strength indicator
  • Bench press (flat barbell) → TRUE upper push strength indicator
  • Romanian deadlift / Barbell deadlift → posterior chain strength
  • Overhead press (barbell) → vertical push strength
  • Barbell row → horizontal pull strength

ACCESSORY MOVEMENTS — DO NOT compare loads to primary lifts, NEVER use to infer 1RM:
  • Goblet squat → mobility drill / pattern reinforcement, typically 16–24kg
    ⚠ A 20kg goblet squat tells you NOTHING about back squat capability
  • Bulgarian split squat, Walking lunges → unilateral work, different biomechanics
  • Leg press, Leg curl, Leg extension → machine work, non-comparable to barbell squat
  • Incline DB press, Cable flies → chest accessory, not comparable to flat bench
  • Face pulls, Band pull-aparts → corrective/shoulder health work

SQUAT REINTRODUCTION BLOCK CONTEXT:
This athlete took 12 weeks off squatting (bench-only block). They are now reintroducing the barbell back squat.
- Goblet squats used early = TECHNIQUE DRILL only, not a strength baseline
- The jump from goblet squat → barbell back squat is a MOVEMENT TRANSITION, not a progression
- Assess back squat load against: (a) RPE feedback, (b) technique quality, (c) pre-hiatus estimates
- Bench press PR: ~115kg. Back squat capability pre-hiatus: estimate ~100–120kg based on typical ratios
- Expect rapid neural recovery of squat strength — this is NOT exceptional, it is normal
- Conservative RPE-6 loading early is CORRECT even if the athlete could lift more

${history}

PROGRAMMING PHILOSOPHY:
- Periodisation: block/DUP for this intermediate athlete
- RPE autoregulation: prescribe RPE targets, not fixed weights
- Progressive overload: increase load when RPE drops below target for 2+ sessions
- Recovery-aware: check HRV/recovery before recommending volume increases
- Technique first: never add load if form is flagged
- For the squat block: prioritise movement quality and pattern restoration over load chasing

WHEN ASKED TO MODIFY THE PROGRAM:
Output the COMPLETE updated sessions array at the END of your response in this exact format:

[PROGRAM_UPDATE]
{
  "sessions": [ ... complete sessions array ... ],
  "coach_notes": "updated notes if changed",
  "week_number": <current week number>
}
[/PROGRAM_UPDATE]

Sessions structure: [{"id":"day1","name":"Day 1 — ...","order":1,"optional":false,"exercises":[{"name":"...","sets":4,"reps":"5","rpe":"6","load_notes":"...","technique_notes":"..."}]}]

Only output [PROGRAM_UPDATE] when actually changing the program.

When researching exercise science, use web search for current evidence. Cite studies when recommending changes.
- Log responses: 4-5 sentences. Chat: as detailed as needed.`
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

export async function getActiveDirectives(coach: 'nutrition' | 'recovery' | 'strength'): Promise<any[]> {
  const { data } = await supabase
    .from('coach_directives')
    .select('*')
    .eq('target_coach', coach)
    .eq('active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('priority', { ascending: false })
  return data || []
}

export async function runCoachChat(
  coach: Coach,
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: any,
  recentLogs: any[],
  recentSessions: any[],
  extra?: { sessionSets?: Record<string, any[]>; directives?: any[]; currentProgram?: any }
): Promise<string> {
  const isSingleLogMessage = messages.length === 1
  const maxTokens = coach === 'strength' ? 2000 : isSingleLogMessage ? 500 : 1024
  const directives = extra?.directives || []

  const tools: any[] = coach === 'strength' ? [{
    type: 'web_search_20250305' as const,
    name: 'web_search',
  }] : []

  let systemPrompt = ''
  switch (coach) {
    case 'nutrition': systemPrompt = getNutritionSystemPrompt(settings, recentLogs, directives); break
    case 'recovery':  systemPrompt = getRecoverySystemPrompt(settings, recentLogs, directives); break
    case 'strength':  systemPrompt = getStrengthSystemPrompt(settings, recentSessions, directives, extra?.sessionSets, extra?.currentProgram); break
    case 'central':   systemPrompt = getCentralSystemPrompt(settings, recentLogs, recentSessions); break
  }

  const requestParams: any = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.slice(-20),
  }
  if (tools.length) requestParams.tools = tools

  const response = await client.messages.create(requestParams)

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
