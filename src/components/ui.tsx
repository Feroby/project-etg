'use client'
import clsx from 'clsx'

export type AccentColor = 'green' | 'blue' | 'amber' | 'purple'

export const ACCENT_BORDER: Record<AccentColor, string> = {
  green:  'border-etg-green/40',
  blue:   'border-etg-blue/40',
  amber:  'border-etg-amber/40',
  purple: 'border-etg-purple/40',
}
export const ACCENT_TEXT: Record<AccentColor, string> = {
  green:  'text-etg-green',
  blue:   'text-etg-blue',
  amber:  'text-etg-amber',
  purple: 'text-etg-purple',
}
export const ACCENT_BG_SUBTLE: Record<AccentColor, string> = {
  green:  'bg-etg-green/10',
  blue:   'bg-etg-blue/10',
  amber:  'bg-etg-amber/10',
  purple: 'bg-etg-purple/10',
}
export const ACCENT_BG_AVATAR: Record<AccentColor, string> = {
  green:  'bg-etg-green/20 text-etg-green',
  blue:   'bg-etg-blue/20 text-etg-blue',
  amber:  'bg-etg-amber/20 text-etg-amber',
  purple: 'bg-etg-purple text-white',
}

export const FIELD_CLS = [
  'bg-[#1a1a1a] border border-white/20 rounded-lg px-3 py-2',
  'text-sm text-white placeholder-white/30',
  'focus:outline-none focus:border-white/50',
  'w-full transition-colors',
].join(' ')

export function Card({ children, className, accent }: {
  children: React.ReactNode; className?: string; accent?: AccentColor
}) {
  return (
    <div className={clsx(
      'bg-[#111] border rounded-xl p-4',
      accent ? ACCENT_BORDER[accent] : 'border-white/15',
      className
    )}>
      {children}
    </div>
  )
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-52 flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">{children}</div>
    </div>
  )
}

export function MetricCard({ label, value, unit }: {
  label: string; value: string | number; unit?: string
}) {
  return (
    <div className="bg-white/6 rounded-lg p-3">
      <div className="text-[11px] uppercase tracking-wider text-white/55 mb-1 font-medium">{label}</div>
      <div className="text-2xl font-semibold text-white/90 leading-none">
        {value ?? '—'}
        {unit && <span className="text-xs text-white/40 ml-1 font-normal">{unit}</span>}
      </div>
    </div>
  )
}

export function Badge({ children, color }: { children: React.ReactNode; color: AccentColor }) {
  const styles: Record<AccentColor, string> = {
    green:  'bg-etg-green/20 text-etg-green',
    blue:   'bg-etg-blue/20 text-etg-blue',
    amber:  'bg-etg-amber/20 text-etg-amber',
    purple: 'bg-etg-purple/20 text-etg-purple',
  }
  return (
    <span className={clsx('text-xs font-medium px-2.5 py-0.5 rounded-full', styles[color])}>
      {children}
    </span>
  )
}

export function CoachAvatar({ coach, size = 'md' }: {
  coach: 'N' | 'R' | 'S' | 'C'; size?: 'sm' | 'md'
}) {
  const color = ({ N: 'green', R: 'amber', S: 'blue', C: 'purple' } as const)[coach]
  return (
    <div className={clsx(
      'rounded-full flex items-center justify-center font-semibold flex-shrink-0',
      ACCENT_BG_AVATAR[color],
      size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
    )}>
      {coach}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 bg-white/6 p-1 rounded-lg mb-4" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            'flex-1 py-2 px-3 text-xs font-medium rounded-md transition-all',
            active === t.id
              ? 'bg-white/12 text-white shadow-sm'
              : 'text-white/55 hover:text-white/80 hover:bg-white/6'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Input({ label, id, type = 'text', placeholder, step, min, max, className }: {
  label: string; id: string; type?: string; placeholder?: string
  step?: string; min?: string; max?: string; className?: string
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-white/70">{label}</label>
      <input id={id} name={id} type={type} placeholder={placeholder} step={step} min={min} max={max}
        className={FIELD_CLS} />
    </div>
  )
}

export function Select({ label, id, options, className }: {
  label: string; id: string; options: { value: string; label: string }[]; className?: string
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-white/70">{label}</label>
      <select id={id} name={id}
        className={clsx(FIELD_CLS, 'cursor-pointer [&>option]:bg-[#1a1a1a] [&>option]:text-white')}>
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Textarea({ label, id, placeholder, rows = 3, className }: {
  label: string; id: string; placeholder?: string; rows?: number; className?: string
}) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-white/70">{label}</label>
      <textarea id={id} name={id} placeholder={placeholder} rows={rows}
        className={clsx(FIELD_CLS, 'resize-none')} />
    </div>
  )
}

// Default type="submit" so Button works inside forms without needing an explicit prop.
// Use type="button" explicitly for standalone action buttons (outside forms).
export function Button({ children, onClick, disabled, variant = 'primary', color = 'green', className, type = 'submit' }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean
  variant?: 'primary' | 'ghost'; color?: AccentColor; className?: string; type?: 'button' | 'submit'
}) {
  const solid: Record<AccentColor, string> = {
    green:  'bg-etg-green hover:bg-etg-green/85',
    blue:   'bg-etg-blue hover:bg-etg-blue/85',
    amber:  'bg-etg-amber hover:bg-etg-amber/85',
    purple: 'bg-etg-purple hover:bg-etg-purple/85',
  }
  const ghost: Record<AccentColor, string> = {
    green:  'border-etg-green/50 text-etg-green hover:bg-etg-green/10',
    blue:   'border-etg-blue/50 text-etg-blue hover:bg-etg-blue/10',
    amber:  'border-etg-amber/50 text-etg-amber hover:bg-etg-amber/10',
    purple: 'border-etg-purple/50 text-etg-purple hover:bg-etg-purple/10',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={clsx(
        'px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary'
          ? clsx('text-white', solid[color])
          : clsx('border bg-transparent', ghost[color]),
        className
      )}>
      {children}
    </button>
  )
}

export function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={clsx(
      'border-2 border-white/25 border-t-white rounded-full animate-spin',
      size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
    )} aria-label="Loading" role="status" />
  )
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4" role="separator">
      <div className="flex-1 border-t border-white/12" />
      {label && <span className="text-xs text-white/40">{label}</span>}
      <div className="flex-1 border-t border-white/12" />
    </div>
  )
}

export function FlagBanner({ flags }: { flags: string[] }) {
  if (!flags.length) return null
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 space-y-1.5" role="alert">
      {flags.map((f, i) => <div key={i} className="text-sm text-red-300 font-medium">{f}</div>)}
    </div>
  )
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\|(.+)\|\r?\n\|[-| :]+\|\r?\n((?:\|.+\|\r?\n?)*)/g, (_, header, rows) => {
      const ths = header.split('|').filter((s: string) => s.trim()).map((s: string) => `<th>${s.trim()}</th>`).join('')
      const trs = rows.trim().split('\n').map((row: string) =>
        '<tr>' + row.split('|').filter((s: string) => s.trim()).map((s: string) => `<td>${s.trim()}</td>`).join('') + '</tr>'
      ).join('')
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
    })
    .replace(/^#{1,3} (.+)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/((?:^[-*] .+\n?)+)/gm, m => '<ul>' + m.replace(/^[-*] (.+)/gm, '<li>$1</li>') + '</ul>')
    .replace(/((?:^\d+\. .+\n?)+)/gm, m => '<ol>' + m.replace(/^\d+\. (.+)/gm, '<li>$1</li>') + '</ol>')
    .split(/\n{2,}/).map(b => {
      b = b.trim()
      if (!b) return ''
      if (/^<(h3|ul|ol|table)/.test(b)) return b
      return '<p>' + b.replace(/\n/g, '<br>') + '</p>'
    }).join('')
}

export function ChatBubble({ role, content, coachKey }: {
  role: 'user' | 'assistant'; content: string; coachKey: 'N' | 'R' | 'S' | 'C'
}) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-white/10 rounded-xl px-4 py-2.5 max-w-[80%] text-sm text-white/90 leading-relaxed">
          {content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2.5 items-start">
      <CoachAvatar coach={coachKey} size="sm" />
      <div
        className="bg-white/6 border border-white/10 rounded-xl px-4 py-3 max-w-[85%] text-sm text-white/85 prose-chat flex-1 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  )
}

export function TypingIndicator({ coachKey }: { coachKey: 'N' | 'R' | 'S' | 'C' }) {
  return (
    <div className="flex gap-2.5 items-start" aria-label="Coach is typing">
      <CoachAvatar coach={coachKey} size="sm" />
      <div className="bg-white/6 border border-white/10 rounded-xl px-4 py-3 flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
