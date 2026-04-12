'use client'

interface Directive { priority: 'high' | 'medium'; action: string; domain: string }
interface Domain { score: number; status: string; summary: string; key_wins: string[]; flags: string[] }
interface Report {
  period: string
  overall_score: number
  headline: string
  domains: { nutrition: Domain; recovery: Domain; strength: Domain }
  cross_domain_insights: string[]
  goal_trajectory?: string    // NEW
  blind_spots?: string[]      // NEW
  directives: Directive[]
  next_checkpoint: string
}

const STATUS = {
  on_track: { dot: 'bg-etg-green', text: 'text-etg-green', border: 'border-etg-green/25', bg: 'bg-etg-green/8', label: 'On track' },
  attention: { dot: 'bg-etg-amber', text: 'text-etg-amber', border: 'border-etg-amber/25', bg: 'bg-etg-amber/8', label: 'Attention' },
  critical:  { dot: 'bg-red-400',   text: 'text-red-400',   border: 'border-red-500/25',   bg: 'bg-red-500/8',  label: 'Critical'  },
}

const DOMAINS = {
  nutrition: { label: 'Nutrition', letter: 'N', color: 'text-etg-green', ring: 'ring-etg-green/30' },
  recovery:  { label: 'Recovery',  letter: 'R', color: 'text-etg-amber', ring: 'ring-etg-amber/30' },
  strength:  { label: 'Strength',  letter: 'S', color: 'text-etg-blue',  ring: 'ring-etg-blue/30'  },
}

const DOMAIN_CHIP: Record<string, string> = {
  nutrition: 'bg-etg-green/12 text-etg-green border-etg-green/25',
  recovery:  'bg-etg-amber/12 text-etg-amber border-etg-amber/25',
  strength:  'bg-etg-blue/12 text-etg-blue border-etg-blue/25',
  all:       'bg-etg-purple/12 text-etg-purple border-etg-purple/25',
}

function ScoreRing({ score }: { score: number }) {
  const r = 20, circ = 2 * Math.PI * r
  const c = score >= 8 ? '#1D9E75' : score >= 6 ? '#e5e5e5' : '#f87171'
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0" aria-label={`Score: ${score}/10`}>
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={c} strokeWidth="4"
        strokeDasharray={`${(score / 10) * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 26 26)" />
      <text x="26" y="31" textAnchor="middle" fontSize="13" fontWeight="700" fill={c}>{score}</text>
    </svg>
  )
}

function OverallRing({ score }: { score: number }) {
  const r = 34, circ = 2 * Math.PI * r
  const c = score >= 8 ? '#1D9E75' : score >= 6 ? '#e5e5e5' : '#f87171'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" aria-label={`Overall score: ${score}/10`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={c} strokeWidth="6"
        strokeDasharray={`${(score / 10) * circ} ${circ}`} strokeLinecap="round" transform="rotate(-90 44 44)" />
      <text x="44" y="49" textAnchor="middle" fontSize="24" fontWeight="700" fill={c}>{score}</text>
      <text x="44" y="62" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">/10</text>
    </svg>
  )
}

export default function SynthesisReport({ report, generatedAt }: { report: Report; generatedAt: string }) {
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-gradient-to-br from-etg-purple/20 via-[#111] to-[#0a0a0a] border border-etg-purple/30 rounded-2xl p-5">
        <div className="flex items-start gap-5">
          <OverallRing score={report.overall_score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[11px] text-etg-purple font-bold uppercase tracking-widest">Performance synthesis</div>
              <div className="text-xs text-white/40">{report.period}</div>
            </div>
            <p className="text-base font-semibold text-white leading-snug mb-2">{report.headline}</p>
            {/* Goal trajectory — new prominent field */}
            {report.goal_trajectory && (
              <p className="text-sm text-white/60 leading-relaxed border-t border-white/8 pt-2 mt-2">{report.goal_trajectory}</p>
            )}
            <div className="text-xs text-white/30 mt-2">
              Generated {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Domain cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['nutrition', 'recovery', 'strength'] as const).map(key => {
          const d = report.domains[key]
          const meta = DOMAINS[key]
          const s = STATUS[d.status as keyof typeof STATUS] || STATUS.on_track
          return (
            <div key={key} className={`bg-[#111] border rounded-xl p-4 ${s.border} ${s.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 ${meta.ring} bg-black/30 ${meta.color}`}>
                    {meta.letter}
                  </div>
                  <span className="text-sm font-semibold text-white">{meta.label}</span>
                </div>
                <ScoreRing score={d.score} />
              </div>
              <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-3 ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                {s.label}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-3">{d.summary}</p>
              {d.key_wins?.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {d.key_wins.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-etg-green/90">
                      <span className="mt-0.5 flex-shrink-0 font-bold">✓</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {d.flags?.length > 0 && (
                <div className="space-y-1.5">
                  {d.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-etg-amber/90">
                      <span className="mt-0.5 flex-shrink-0">⚠</span><span>{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Cross-domain insights */}
      {report.cross_domain_insights?.length > 0 && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4">
          <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Cross-domain insights</div>
          <div className="space-y-3">
            {report.cross_domain_insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-etg-purple/25 text-etg-purple flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-white/75 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blind spots — NEW section */}
      {report.blind_spots?.length > 0 && (
        <div className="bg-etg-purple/8 border border-etg-purple/20 rounded-xl p-4">
          <div className="text-xs font-bold text-etg-purple/70 uppercase tracking-widest mb-3">Blind spots</div>
          <div className="space-y-2.5">
            {report.blind_spots.map((spot, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-etg-purple/60 flex-shrink-0 mt-0.5 text-sm">◈</span>
                <p className="text-sm text-white/75 leading-relaxed">{spot}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directives */}
      {report.directives?.length > 0 && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4">
          <div className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Directives</div>
          <div className="space-y-3">
            {report.directives.map((d, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${DOMAIN_CHIP[d.domain] || DOMAIN_CHIP.all}`}>
                  {d.domain}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${d.priority === 'high' ? 'bg-red-400' : 'bg-etg-amber'}`} />
                    <span className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{d.priority}</span>
                  </div>
                  <p className="text-sm text-white/85 leading-snug">{d.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next checkpoint */}
      {report.next_checkpoint && (
        <div className="bg-etg-purple/6 border border-etg-purple/18 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-etg-purple mt-0.5 flex-shrink-0">→</span>
          <div>
            <div className="text-xs text-etg-purple/70 uppercase tracking-wider font-bold mb-1">Next checkpoint</div>
            <p className="text-sm text-white/65 leading-relaxed">{report.next_checkpoint}</p>
          </div>
        </div>
      )}

    </div>
  )
}
