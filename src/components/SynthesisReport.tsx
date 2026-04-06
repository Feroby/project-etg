'use client'

interface Directive { priority: 'high' | 'medium'; action: string; domain: string }
interface Domain { score: number; status: string; summary: string; key_wins: string[]; flags: string[] }
interface Report {
  period: string
  overall_score: number
  headline: string
  domains: { nutrition: Domain; recovery: Domain; strength: Domain }
  cross_domain_insights: string[]
  directives: Directive[]
  next_checkpoint: string
}

const STATUS_COLOR = {
  on_track: { dot: 'bg-etg-green', text: 'text-etg-green', bg: 'bg-etg-green/10 border-etg-green/20', label: 'On track' },
  attention: { dot: 'bg-etg-amber', text: 'text-etg-amber', bg: 'bg-etg-amber/10 border-etg-amber/20', label: 'Attention' },
  critical:  { dot: 'bg-red-400',   text: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',     label: 'Critical'  },
}

const DOMAIN_META = {
  nutrition: { label: 'Nutrition',  letter: 'N', color: 'text-etg-green', ring: 'ring-etg-green/30', accent: 'etg-green' },
  recovery:  { label: 'Recovery',   letter: 'R', color: 'text-etg-amber', ring: 'ring-etg-amber/30', accent: 'etg-amber' },
  strength:  { label: 'Strength',   letter: 'S', color: 'text-etg-blue',  ring: 'ring-etg-blue/30',  accent: 'etg-blue'  },
}

const DIRECTIVE_DOMAIN_COLOR: Record<string, string> = {
  nutrition: 'bg-etg-green/10 text-etg-green border-etg-green/20',
  recovery:  'bg-etg-amber/10 text-etg-amber border-etg-amber/20',
  strength:  'bg-etg-blue/10 text-etg-blue border-etg-blue/20',
  all:       'bg-etg-purple/10 text-etg-purple border-etg-purple/20',
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const fill = (score / 10) * circ
  const scoreColor = score >= 8 ? '#1D9E75' : score >= 6 ? '#ffffff' : '#f87171'
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="flex-shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={scoreColor} strokeWidth="4"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 26 26)" />
      <text x="26" y="31" textAnchor="middle" fontSize="13" fontWeight="600" fill={scoreColor}>{score}</text>
    </svg>
  )
}

function OverallScore({ score }: { score: number }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const fill = (score / 10) * circ
  const scoreColor = score >= 8 ? '#1D9E75' : score >= 6 ? '#ffffff' : '#f87171'
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={scoreColor} strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 44 44)" />
      <text x="44" y="48" textAnchor="middle" fontSize="22" fontWeight="700" fill={scoreColor}>{score}</text>
      <text x="44" y="61" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.3)">/10</text>
    </svg>
  )
}

export default function SynthesisReport({ report, generatedAt }: { report: Report; generatedAt: string }) {
  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-gradient-to-br from-etg-purple/20 via-[#111] to-[#0a0a0a] border border-etg-purple/30 rounded-2xl p-5">
        <div className="flex items-start gap-5">
          <OverallScore score={report.overall_score} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-[10px] text-etg-purple font-semibold uppercase tracking-widest">Performance synthesis</div>
              <div className="text-[10px] text-white/25">{report.period}</div>
            </div>
            <p className="text-base font-medium text-white leading-snug mb-2">{report.headline}</p>
            <div className="text-[10px] text-white/25">
              Generated {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Domain cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['nutrition', 'recovery', 'strength'] as const).map(key => {
          const d = report.domains[key]
          const meta = DOMAIN_META[key]
          const s = STATUS_COLOR[d.status as keyof typeof STATUS_COLOR] || STATUS_COLOR.on_track
          return (
            <div key={key} className={`bg-[#111] border rounded-xl p-4 ${s.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 ${meta.ring} bg-black/30 ${meta.color}`}>
                    {meta.letter}
                  </div>
                  <span className="text-xs font-medium text-white">{meta.label}</span>
                </div>
                <ScoreRing score={d.score} color={meta.color} />
              </div>
              <div className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider mb-2.5 px-1.5 py-0.5 rounded ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </div>
              <p className="text-xs text-white/60 leading-relaxed mb-3">{d.summary}</p>
              {d.key_wins.length > 0 && (
                <div className="space-y-1 mb-2">
                  {d.key_wins.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-etg-green/80">
                      <span className="mt-0.5 flex-shrink-0">✓</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {d.flags.length > 0 && (
                <div className="space-y-1">
                  {d.flags.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-etg-amber/80">
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
        <div className="bg-[#111] border border-white/8 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Cross-domain insights</div>
          <div className="space-y-2.5">
            {report.cross_domain_insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-etg-purple/20 text-etg-purple flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directives */}
      {report.directives?.length > 0 && (
        <div className="bg-[#111] border border-white/8 rounded-xl p-4">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-3">Today&apos;s directives</div>
          <div className="space-y-2">
            {report.directives.map((d, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`flex-shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${DIRECTIVE_DOMAIN_COLOR[d.domain] || DIRECTIVE_DOMAIN_COLOR.all}`}>
                  {d.domain}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {d.priority === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />}
                    {d.priority === 'medium' && <span className="w-1.5 h-1.5 rounded-full bg-etg-amber flex-shrink-0" />}
                    <span className="text-[9px] text-white/25 uppercase tracking-wider">{d.priority}</span>
                  </div>
                  <p className="text-sm text-white/80 leading-snug">{d.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next checkpoint */}
      {report.next_checkpoint && (
        <div className="bg-etg-purple/5 border border-etg-purple/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <div className="text-etg-purple mt-0.5 flex-shrink-0 text-sm">→</div>
          <div>
            <div className="text-[10px] text-etg-purple/60 uppercase tracking-wider font-semibold mb-0.5">Next checkpoint</div>
            <p className="text-sm text-white/60 leading-relaxed">{report.next_checkpoint}</p>
          </div>
        </div>
      )}

    </div>
  )
}
