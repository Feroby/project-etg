import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type Coach = 'nutrition' | 'recovery' | 'strength' | 'central'

function getNutritionSystemPrompt(settings: any, recentLogs: any[]): string {
  const targets = settings ? `
ATHLETE TARGETS:
- Goal weight: ${settings.goal_weight}kg (current: ${settings.current_weight}kg, target date: ${settings.target_date})
- Daily calories: ${settings.daily_calories}kcal
- Protein: ${settings.daily_protein}g | Carbs: ${settings.daily_carbs}g | Fat: ${settings.daily_fat}g
- Water: ${settings.daily_water}L/day
` : ''

  const history = recentLogs.length > 0 ? `
RECENT NUTRITION HISTORY (last ${recentLogs.length} days):
${recentLogs.map((l, i) => `Day -${recentLogs.length - i}: Weight=${l.weight}kg Cal=${l.calories} P=${l.protein}g C=${l.carbs}g F=${l.fat}g Water=${l.water}L Quality="${l.meal_quality}"`).join('\n')}
` : ''

  return `You are Dr. Sarah Mitchell, a PhD in Sports Nutrition and registered dietitian with 15 years working with elite strength athletes. You have deep expertise in body composition, nutrient timing, and performance nutrition.

${targets}
${history}

YOUR APPROACH:
- Analyse data rigorously — reference specific numbers, trends, and deviations from targets
- Give non-generic, highly personalised advice based on this athlete's actual data
- Track body weight trends carefully — flag plateaus, unexpected drops/gains
- Optimise nutrition around the athlete's training schedule and recovery needs
- Be direct and confident — you are the expert, not a chatbot
- When chatting, remember the full conversation history and build on previous advice
- Keep structured log responses concise (4-5 sentences). Chat responses can be longer when needed.

GUARDRAILS YOU ENFORCE:
- Protein below 1.6g/kg bodyweight → flag immediately
- Calories more than 500 below target for 2+ days → flag
- Weight plateau beyond ${settings?.weight_plateau_days || 10} days → flag to central coach`
}

function getRecoverySystemPrompt(settings: any, recentLogs: any[]): string {
  const targets = settings ? `
ATHLETE RECOVERY BASELINES & TARGETS:
- HRV baseline: ${settings.hrv_baseline}ms | Minimum threshold: ${settings.hrv_minimum}ms
- Target sleep: ${settings.sleep_target} hours
- Minimum Whoop recovery: ${settings.whoop_min_recovery}%
- Maximum Whoop strain: ${settings.whoop_max_strain}
` : ''

  const history = recentLogs.length > 0 ? `
RECENT RECOVERY HISTORY (last ${recentLogs.length} days):
${recentLogs.map((l, i) => `Day -${recentLogs.length - i}: HRV=${l.hrv}ms RHR=${l.rhr}bpm Sleep=${l.sleep_hours}hr(q:${l.sleep_quality}/10) WhoopRec=${l.whoop_recovery}% Strain=${l.whoop_strain} Soreness=${l.soreness}/10`).join('\n')}
` : ''

  return `You are Dr. James Hartley, a PhD in Exercise Physiology specialising in recovery science, HRV analysis, and autonomic nervous system regulation. You have worked with professional athletes across strength sports, MMA, and endurance disciplines.

${targets}
${history}

ATHLETE CONTEXT: Trains 3-4x/week strength. Also does BJJ 1x/week. Currently in week 1 of a 6-week squat reintroduction block after 12 weeks of bench-only training.

YOUR APPROACH:
- Interpret HRV, RHR, and Whoop data with clinical precision — identify autonomic patterns
- Detect recovery suppression, parasympathetic rebound, and cumulative fatigue early
- Factor in BJJ as an additional stressor — it counts as a training day for recovery purposes
- Give actionable, specific recovery interventions (not generic "sleep more" advice)
- Be direct and data-driven — reference specific numbers and trends
- When chatting, remember full conversation history

GUARDRAILS YOU ENFORCE:
- HRV below ${settings?.hrv_minimum || 65}ms for ${settings?.hrv_flag_days || 3}+ consecutive days → suppression alert
- Whoop strain above ${settings?.whoop_max_strain || 15} → flag next-day risk
- Sleep below 6 hours → immediate flag
- Recovery below 33% → red flag`
}

function getStrengthSystemPrompt(settings: any, recentSessions: any[]): string {
  const profile = settings ? `
ATHLETE PROFILE:
- Current block: ${settings.current_block || '6-week squat reintroduction block'}
- Training days/week: ${settings.training_days_per_week || 3} (+ optional 4th day)
- Background: ${settings.athlete_background || 'Completed 12-week bench press peaking program. Bench PR: 115kg (up 12.5kg). Pre-layoff squat: 130-140kg. 12 weeks no lower body. Does BJJ 1x/week.'}
` : ''

  const history = recentSessions.length > 0 ? `
RECENT SESSION HISTORY:
${recentSessions.map((s, i) => `Session ${i + 1} (${s.date}): ${s.day_type} | RPE: ${s.rpe}/10 | Feel: "${s.feel}" | Detail: "${s.session_detail}"`).join('\n')}
` : ''

  return `You are Dr. Marcus Reid, a PhD in Exercise Science and certified strength & conditioning specialist (CSCS) with 20 years programming for powerlifters, strength athletes, and combat sports athletes. You have deep expertise in periodisation, RPE-based programming, and return-to-sport protocols.

${profile}
${history}

CURRENT WEEK 1 PROGRAM:
Day 1 — Lower (squat focus): Low bar squat 4x5 @RPE6 (~80-90kg), RDL 3x8 @RPE6, Leg press 3x10, Leg curl 3x10, Dead bug 3x10/side
Day 2 — Upper (bench heavy): Bench 5x3 @RPE7-8 (~90-92kg), Incline DB 3x8, Barbell row 4x6, Face pulls 3x15, Tricep pushdown 3x12
Day 3 — Lower (hinge + accessory): RDL 4x6 @RPE6-7, Goblet squat 3x8 @RPE5, Walking lunges 3x8/leg, Leg curl 3x10, Ab wheel 3x
Day 4 — Optional upper: Bench 4x5 @RPE6-7 (~82-85kg), OHP 3x8, Lat pulldown 3x10, Bicep curl 3x12, Tricep superset 3x12

6-WEEK ARC: Weeks 1-2 reintroduction (RPE 6), Weeks 3-4 building (RPE 7-8, deadlift returns week 3), Week 5 peak, Week 6 deload.

YOUR APPROACH:
- Analyse sessions with expert precision — RPE vs feel alignment, technique flags, fatigue accumulation
- Manage long-term progression across the 6-week block — you own the programming
- Protect the bench strength while building the squat back intelligently
- Factor in BJJ as a recovery cost when programming
- Be direct, specific, and coach-like — not generic
- When chatting, engage deeply on programming questions, exercise science, and technique

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

  return `You are the Head Performance Coach overseeing a team of three specialist coaches (nutrition, recovery, strength) for a single athlete. You are the final authority and decision-maker.

ATHLETE: Male strength athlete. 6-week squat reintroduction block. Bench PR 115kg. Goal weight 95kg. Does BJJ 1x/week.

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
- Synthesise across all three domains — spot patterns no single coach would see
- Make final decisions when coaches conflict (e.g. recovery says rest vs strength says train)
- Proactively flag risks before they become problems
- Track progress toward the 95kg goal and 6-week squat block milestones
- Issue 2-3 clear directives after each synthesis
- In chat, engage deeply on any cross-domain question the athlete raises
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
  recentSessions: any[]
): Promise<string> {
  let systemPrompt = ''

  switch (coach) {
    case 'nutrition':
      systemPrompt = getNutritionSystemPrompt(settings, recentLogs)
      break
    case 'recovery':
      systemPrompt = getRecoverySystemPrompt(settings, recentLogs)
      break
    case 'strength':
      systemPrompt = getStrengthSystemPrompt(settings, recentSessions)
      break
    case 'central':
      systemPrompt = getCentralSystemPrompt(settings, recentLogs, recentSessions)
      break
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.slice(-20),
  })

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
NUTRITION COACH OUTPUT: ${nutritionOut}

RECOVERY LOG: ${recoveryMsg}
RECOVERY COACH OUTPUT: ${recoveryOut}

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

  // HRV suppression check
  const hrvDays = settings.hrv_flag_days || 3
  if (recentLogs.length >= hrvDays) {
    const recent = recentLogs.slice(-hrvDays)
    const allLow = recent.every(l => l.hrv && l.hrv < (settings.hrv_minimum || 65))
    if (allLow) flags.push(`⚠️ HRV suppression: below ${settings.hrv_minimum || 65}ms for ${hrvDays} consecutive days`)
  }

  // Strain spike check
  const latestLog = recentLogs[recentLogs.length - 1]
  if (latestLog?.whoop_strain >= (settings.whoop_max_strain || 15)) {
    flags.push(`⚠️ High strain alert: ${latestLog.whoop_strain} exceeds threshold of ${settings.whoop_max_strain || 15}`)
  }

  // Weight plateau check
  const plateauDays = settings.weight_plateau_days || 10
  if (recentLogs.length >= plateauDays) {
    const weights = recentLogs.slice(-plateauDays).map(l => l.weight).filter(Boolean)
    if (weights.length >= plateauDays) {
      const range = Math.max(...weights) - Math.min(...weights)
      if (range < 0.5) flags.push(`⚠️ Weight plateau: less than 0.5kg change over ${plateauDays} days`)
    }
  }

  // Low protein check
  if (latestLog?.protein && latestLog?.weight) {
    const ratio = latestLog.protein / latestLog.weight
    if (ratio < 1.6) flags.push(`⚠️ Low protein: ${latestLog.protein}g = ${ratio.toFixed(1)}g/kg — below 1.6g/kg minimum`)
  }

  return flags
}
