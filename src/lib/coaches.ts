import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Coach = 'nutrition' | 'recovery' | 'strength' | 'central'

async function trackUsage(coach: Coach, inputTokens: number, outputTokens: number) {
  try {
    const INPUT_COST_PER_M = 3.0
    const OUTPUT_COST_PER_M = 15.0
    const cost = (inputTokens / 1_000_000) * INPUT_COST_PER_M + (outputTokens / 1_000_000) * OUTPUT_COST_PER_M
    const { supabase } = await import('./supabase')
    await supabase.from('api_usage').insert({
      coach,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      estimated_cost_usd: cost,
    })
  } catch (e) {
    console.error('Usage tracking failed:', e)
  }
}

// Always-present settings block injected into every coach prompt
function buildSettingsBlock(settings: any): string {
  if (!settings) return 'ATHLETE SETTINGS: Not configured yet.'
  return `ATHLETE SETTINGS & TARGETS (always reference these directly when asked):
- Goal weight: ${settings.goal_weight ?? 'not set'}kg | Current weight: ${settings.current_weight ?? 'not set'}kg | Target date: ${settings.target_date ?? 'not set'}
- Daily calorie target: ${settings.daily_calories ?? 'not set'}kcal
- Protein target: ${settings.daily_protein ?? 'not set'}g | Carbs: ${settings.daily_carbs ?? 'not set'}g | Fat: ${settings.daily_fat ?? 'not set'}g | Water: ${settings.daily_water ?? 'not set'}L/day
- HRV baseline: ${settings.hrv_baseline ?? 'not set'}ms | HRV minimum: ${settings.hrv_minimum ?? 'not set'}ms
- Sleep target: ${settings.sleep_target ?? 'not set'}hr | Min Whoop recovery: ${settings.whoop_min_recovery ?? 'not set'}% | Max strain: ${settings.whoop_max_strain ?? 'not set'}
- Training days/week: ${settings.training_days_per_week ?? 'not set'} | Current block: ${settings.current_block ?? 'not set'}
- Primary goal: ${settings.training_goal ?? 'not set'}
- Background: ${settings.athlete_background ?? 'not set'}`
}

function getNutritionSystemPrompt(settings: any, recentLogs: any[]): string {
  const history = recentLogs.length > 0 ? `
RECENT NUTRITION HISTORY (last ${recentLogs.length} days):
${recentLogs.map((l, i) => `Day -${recentLogs.length - i}: Weight=${l.weight}kg Cal=${l.calories} P=${l.protein}g C=${l.carbs}g F=${l.fat}g Water=${l.water}L Quality="${l.meal_quality}"`).join('\n')}
` : 'RECENT HISTORY: No logs yet.'

  return `You are Dr. Sarah Mitchell, a PhD in Sports Nutrition and registered dietitian with 15 years working with elite strength athletes.

${buildSettingsBlock(settings)}

${history}

YOUR APPROACH:
- You have full access to the athlete's goals and targets above — when asked about goal weight, calorie targets, macros or any setting, answer immediately and precisely
- Analyse data rigorously — reference specific numbers, trends, and deviations from targets
- Give non-generic, highly personalised advice based on this athlete's actual data
- Track body weight trends carefully — flag plateaus, unexpected drops/gains
- Be direct and confident — you are the expert, not a chatbot
- Keep structured log responses concise (4-5 sentences). Chat responses can be longer.

GUARDRAILS YOU ENFORCE:
- Protein below 1.6g/kg bodyweight → flag immediately
- Calories more than 500 below target for 2+ days → flag
- Weight plateau beyond ${settings?.weight_plateau_days || 10} days → flag to central coach`
}

function getRecoverySystemPrompt(settings: any, recentLogs: any[]): string {
  const history = recentLogs.length > 0 ? `
RECENT RECOVERY HISTORY (last ${recentLogs.length} days):
${recentLogs.map((l, i) => `Day -${recentLogs.length - i}: HRV=${l.hrv}ms RHR=${l.rhr}bpm Sleep=${l.sleep_hours}hr(q:${l.sleep_quality}/10) WhoopRec=${l.whoop_recovery}% Strain=${l.whoop_strain} Soreness=${l.soreness}/10`).join('\n')}
` : 'RECENT HISTORY: No logs yet.'

  return `You are Dr. James Hartley, a PhD in Exercise Physiology specialising in recovery science, HRV analysis, and autonomic nervous system regulation.

${buildSettingsBlock(settings)}

${history}

ATHLETE CONTEXT: Trains 3-4x/week strength. Also does BJJ 1x/week. Currently in a 6-week squat reintroduction block after 12 weeks of bench-only training.

YOUR APPROACH:
- You have full access to the athlete's recovery baselines and targets above — reference them directly
- Interpret HRV, RHR, and Whoop data with clinical precision — identify autonomic patterns
- Detect recovery suppression, parasympathetic rebound, and cumulative fatigue early
- Factor in BJJ as an additional stressor — it counts as a training day for recovery purposes
- Give actionable, specific recovery interventions
- Be direct and data-driven — reference specific numbers and trends

GUARDRAILS YOU ENFORCE:
- HRV below ${settings?.hrv_minimum || 65}ms for ${settings?.hrv_flag_days || 3}+ consecutive days → suppression alert
- Whoop strain above ${settings?.whoop_max_strain || 15} → flag next-day risk
- Sleep below 6 hours → immediate flag
- Recovery below 33% → red flag`
}

function getStrengthSystemPrompt(settings: any, recentSessions: any[], sessionSets?: Record<string, any[]>): string {
  const history = recentSessions.length > 0 ? (() => {
    const lines = recentSessions.map((s, i) => {
      const sets = sessionSets?.[s.id] || []
      const seenEx: Record<string,boolean> = {}; const exNames: string[] = []; sets.forEach((st:any)=>{ if(!seenEx[st.exercise_name]){seenEx[st.exercise_name]=true;exNames.push(st.exercise_name)} })
      const setDetail = exNames.length > 0
        ? exNames.map((ex: string) => {
            const exSets = sets.filter((st: any) => st.exercise_name === ex)
            return `  ${ex}: ${exSets.map((st: any) => `${st.weight || '-'}kg x${st.reps || '-'} @RPE${st.rpe || '-'}`).join(', ')}`
          }).join('\n')
        : `  ${s.session_detail || 'No set data'}`
      return `Session ${i + 1} (${s.date}): ${s.day_type} | Feel: "${s.feel}" | Duration: ${s.duration}min\n${setDetail}`
    })
    return `\nRECENT SESSION HISTORY (with exercise data):\n${lines.join('\n\n')}\n`
  })() : 'RECENT HISTORY: No sessions yet.'

  return `You are Dr. Marcus Reid, a PhD in Exercise Science and certified strength & conditioning specialist (CSCS) with 20 years programming for powerlifters, strength athletes, and combat sports athletes.

${buildSettingsBlock(settings)}

${history}

CURRENT WEEK 1 PROGRAM:
Day 1 — Lower (squat focus): Low bar squat 4x5 @RPE6 (~80-90kg), RDL 3x8 @RPE6, Leg press 3x10, Leg curl 3x10, Dead bug 3x10/side
Day 2 — Upper (bench heavy): Bench 5x3 @RPE7-8 (~90-92kg), Incline DB 3x8, Barbell row 4x6, Face pulls 3x15, Tricep pushdown 3x12
Day 3 — Lower (hinge + accessory): RDL 4x6 @RPE6-7, Goblet squat 3x8 @RPE5, Walking lunges 3x8/leg, Leg curl 3x10, Ab wheel 3x
Day 4 — Optional upper: Bench 4x5 @RPE6-7 (~82-85kg), OHP 3x8, Lat pulldown 3x10, Bicep curl 3x12, Tricep superset 3x12

6-WEEK ARC: Weeks 1-2 reintroduction (RPE 6), Weeks 3-4 building (RPE 7-8, deadlift returns week 3), Week 5 peak, Week 6 deload.

YOUR APPROACH:
- You have full access to the athlete's profile and goals above — reference them directly
- Analyse sessions with expert precision — RPE vs feel alignment, technique flags, fatigue accumulation
- Manage long-term progression across the 6-week block — you own the programming
- Protect bench strength while building the squat back intelligently
- Factor in BJJ as a recovery cost when programming
- Be direct, specific, and coach-like

GUARDRAILS YOU ENFORCE:
- RPE consistently higher than prescribed → volume or load reduction
- Mobility issues flagged in squats → modify before adding load
- Skip day 4 recommendation if recovery metrics are poor`
}

function getCentralSystemPrompt(settings: any, recentLogs: any[], recentSessions: any[]): string {
  const nutritionSummary = recentLogs.slice(-7).map(l =>
    `${l.date}: Cal=${l.calories} P=${l.protein}g W=${l.weight}kg Water=${l.water}L`
  ).join('\n')
  const recoverySummary = recentLogs.slice(-7).map(l =>
    `${l.date}: HRV=${l.hrv}ms Sleep=${l.sleep_hours}hr WhoopRec=${l.whoop_recovery}% Strain=${l.whoop_strain}`
  ).join('\n')
  const strengthSummary = recentSessions.slice(-5).map(s =>
    `${s.date}: ${s.day_type} RPE=${s.rpe} Feel="${s.feel}"`
  ).join('\n')

  return `You are the Head Performance Coach overseeing three specialist coaches (nutrition, recovery, strength) for a single athlete. You are the final authority and decision-maker.

${buildSettingsBlock(settings)}

RECENT NUTRITION DATA:
${nutritionSummary || 'No data yet'}

RECENT RECOVERY DATA:
${recoverySummary || 'No data yet'}

RECENT STRENGTH DATA:
${strengthSummary || 'No data yet'}

SPECIALIST COACH OUTPUTS:
Nutrition coach: ${recentLogs[recentLogs.length - 1]?.nutrition_output || 'No output yet'}
Recovery coach: ${recentLogs[recentLogs.length - 1]?.recovery_output || 'No output yet'}
Strength coach: ${recentSessions[recentSessions.length - 1]?.coach_output || 'No output yet'}

YOUR ROLE:
- You have full access to all athlete settings, goals and data above — reference them directly
- Synthesise across all three domains — spot patterns no single coach would see
- Make final decisions when coaches conflict
- Proactively flag risks before they become problems
- Track progress toward the goal weight and block milestones
- Issue 2-3 clear directives after each synthesis
- In chat, engage deeply on any cross-domain question
- You do NOT have a daily input form — you only synthesise and direct

GUARDRAILS YOU MONITOR:
- Cross-domain suppression: poor recovery + high training volume + low calories = risk
- Stagnation: weight plateau + low protein + high fatigue = intervention needed
- Overreach: RPE drift upward + HRV decline + poor sleep = mandatory deload flag`
}

export async function runCoachChat(
  coach: Coach,
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: any,
  recentLogs: any[],
  recentSessions: any[],
  extra?: any
): Promise<string> {
  let systemPrompt = ''
  switch (coach) {
    case 'nutrition': systemPrompt = getNutritionSystemPrompt(settings, recentLogs); break
    case 'recovery': systemPrompt = getRecoverySystemPrompt(settings, recentLogs); break
    case 'strength': systemPrompt = getStrengthSystemPrompt(settings, recentSessions, (extra as any)?.sessionSets); break
    case 'central': systemPrompt = getCentralSystemPrompt(settings, recentLogs, recentSessions); break
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.slice(-20),
  })

  await trackUsage(coach, response.usage.input_tokens, response.usage.output_tokens)
  return response.content.map(b => b.type === 'text' ? b.text : '').join('')
}

export async function runDailyPipeline(
  logData: any,
  settings: any,
  recentLogs: any[],
  recentSessions: any[]
): Promise<{ nutrition: string; recovery: string; central: string }> {
  const nutritionMsg = `Daily log submitted:
Weight: ${logData.weight}kg | Water: ${logData.water}L
Calories: ${logData.calories} | Protein: ${logData.protein}g | Carbs: ${logData.carbs}g | Fat: ${logData.fat}g
Meal quality: ${logData.meal_quality}
Notes: "${logData.nutrition_notes || 'none'}"`

  const recoveryMsg = `Daily log submitted:
HRV: ${logData.hrv}ms | RHR: ${logData.rhr}bpm
Sleep: ${logData.sleep_hours}hr (quality: ${logData.sleep_quality}/10)
Whoop recovery: ${logData.whoop_recovery}% | Strain: ${logData.whoop_strain}
Soreness: ${logData.soreness}/10
Notes: "${logData.recovery_notes || 'none'}"`

  const [nutritionOut, recoveryOut] = await Promise.all([
    runCoachChat('nutrition', [{ role: 'user', content: nutritionMsg }], settings, recentLogs, recentSessions),
    runCoachChat('recovery', [{ role: 'user', content: recoveryMsg }], settings, recentLogs, recentSessions),
  ])

  const centralMsg = `New daily data submitted. Date: ${logData.date}
NUTRITION LOG: ${nutritionMsg}
NUTRITION COACH: ${nutritionOut}
RECOVERY LOG: ${recoveryMsg}
RECOVERY COACH: ${recoveryOut}
Provide your synthesis and today's key directives.`

  const centralOut = await runCoachChat('central', [{ role: 'user', content: centralMsg }], settings, recentLogs, recentSessions)
  return { nutrition: nutritionOut, recovery: recoveryOut, central: centralOut }
}

export async function runStrengthPipeline(
  sessionData: any,
  settings: any,
  recentLogs: any[],
  recentSessions: any[]
): Promise<string> {
  const msg = `Session logged:
${sessionData.day_type} | RPE: ${sessionData.rpe}/10 | Duration: ${sessionData.duration}min | Feel: "${sessionData.feel}"
Detail: "${sessionData.session_detail}"
Notes: "${sessionData.session_notes || 'none'}"`
  return runCoachChat('strength', [{ role: 'user', content: msg }], settings, recentLogs, recentSessions)
}

export async function checkGuardrails(recentLogs: any[], settings: any): Promise<string[]> {
  const flags: string[] = []
  if (!settings || recentLogs.length < 1) return flags

  const hrvDays = settings.hrv_flag_days || 3
  if (recentLogs.length >= hrvDays) {
    const recent = recentLogs.slice(-hrvDays)
    const allLow = recent.every((l: any) => l.hrv && l.hrv < (settings.hrv_minimum || 65))
    if (allLow) flags.push(`⚠️ HRV suppression: below ${settings.hrv_minimum || 65}ms for ${hrvDays} consecutive days`)
  }

  const latestLog = recentLogs[recentLogs.length - 1]
  if (latestLog?.whoop_strain >= (settings.whoop_max_strain || 15)) {
    flags.push(`⚠️ High strain alert: ${latestLog.whoop_strain} exceeds threshold of ${settings.whoop_max_strain || 15}`)
  }

  const plateauDays = settings.weight_plateau_days || 10
  if (recentLogs.length >= plateauDays) {
    const weights = recentLogs.slice(-plateauDays).map((l: any) => l.weight).filter(Boolean)
    if (weights.length >= plateauDays) {
      const range = Math.max(...weights) - Math.min(...weights)
      if (range < 0.5) flags.push(`⚠️ Weight plateau: less than 0.5kg change over ${plateauDays} days`)
    }
  }

  if (latestLog?.protein && latestLog?.weight) {
    const ratio = latestLog.protein / latestLog.weight
    if (ratio < 1.6) flags.push(`⚠️ Low protein: ${latestLog.protein}g = ${ratio.toFixed(1)}g/kg — below 1.6g/kg minimum`)
  }

  return flags
}
