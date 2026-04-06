'use client'
import { useState } from 'react'
import clsx from 'clsx'

export function Card({ children, className, accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  const borders: Record<string, string> = {
    green: 'border-etg-green/40',
    blue: 'border-etg-blue/40',
    amber: 'border-etg-amber/40',
    purple: 'border-etg-purple/40',
  }
  return (
    <div className={clsx('bg-[#111] border rounded-xl p-4', accent ? borders[accent] : 'border-white/10', className)}>
      {children}
    </div>
  )
}

export function MetricCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{label}</div>
      <div className="text-xl font-medium text-white">
        {value ?? '—'}
        {unit && <span className="text-xs text-white/40 ml-1">{unit}</span>}
      </div>
    </div>
  )
}

export function Badge({ children, color }: { children: React.ReactNode; color: 'green' | 'blue' | 'amber' | 'purple' }) {
  const styles = {
    green: 'bg-etg-green/20 text-etg-green',
    blue: 'bg-etg-blue/20 text-etg-blue',
    amber: 'bg-etg-amber/20 text-etg-amber',
    purple: 'bg-etg-purple/20 text-etg-purple',
  }
  return <span className={clsx('text-[10px] font-medium px-2 py-0.5 rounded-full', styles[color])}>{children}</span>
}

export function Button({ children, onClick, disabled, variant = 'primary', color = 'green', className }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost'
  color?: 'green' | 'blue' | 'amber' | 'purple'
  className?: string
}) {
  const colors = {
    green: 'bg-etg-green hover:bg-etg-green/80',
    blue: 'bg-etg-blue hover:bg-etg-blue/80',
    amber: 'bg-etg-amber hover:bg-etg-amber/80',
    purple: 'bg-etg-purple hover:bg-etg-purple/80',
  }
  const ghostColors = {
    green: 'border-etg-green/40 text-etg-green hover:bg-etg-green/10',
    blue: 'border-etg-blue/40 text-etg-blue hover:bg-etg-blue/10',
    amber: 'border-etg-amber/40 text-etg-amber hover:bg-etg-amber/10',
    purple: 'border-etg-purple/40 text-etg-purple hover:bg-etg-purple/10',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' ? clsx('text-white', colors[color]) : clsx('border bg-transparent', ghostColors[color]),
        className
      )}
    >
      {children}
    </button>
  )
}

export function Input({ label, id, type = 'text', placeholder, step, min, max, className }: {
  label: string; id: string; type?: string; placeholder?: string; step?: string; min?: string; max?: string; className?: string
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-white/50">{label}</label>
      <input
        id={id} name={id} type={type} placeholder={placeholder} step={step} min={min} max={max}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full"
      />
    </div>
  )
}

export function Select({ label, id, options, className }: {
  label: string; id: string; options: { value: string; label: string }[]; className?: string
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-white/50">{label}</label>
      <select
        id={id} name={id}
        className="bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 w-full cursor-pointer [&>option]:bg-[#1a1a1a] [&>option]:text-white"
      >
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
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs text-white/50">{label}</label>
      <textarea
        id={id} name={id} placeholder={placeholder} rows={rows}
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 w-full resize-none"
      />
    </div>
  )
}

export function Spinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={clsx(
      'border-2 border-white/20 border-t-white rounded-full animate-spin',
      size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
    )} />
  )
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-white/10" />
      {label && <span className="text-[11px] text-white/30">{label}</span>}
      <div className="flex-1 border-t border-white/10" />
    </div>
  )
}

export function CoachAvatar({ coach }: { coach: 'N' | 'R' | 'S' | 'C' }) {
  const styles = {
    N: 'bg-etg-green/20 text-etg-green',
    R: 'bg-etg-amber/20 text-etg-amber',
    S: 'bg-etg-blue/20 text-etg-blue',
    C: 'bg-etg-purple text-white',
  }
  return (
    <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0', styles[coach])}>
      {coach}
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
    .replace(/^### (.+)/gm, '<h3>$1</h3>')
    .replace(/^## (.+)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/((?:^[-*] .+\n?)+)/gm, (m) => '<ul>' + m.replace(/^[-*] (.+)/gm, '<li>$1</li>') + '</ul>')
    .replace(/((?:^\d+\. .+\n?)+)/gm, (m) => '<ol>' + m.replace(/^\d+\. (.+)/gm, '<li>$1</li>') + '</ol>')
    .split(/\n{2,}/)
    .map(b => {
      b = b.trim()
      if (!b) return ''
      if (/^<(h3|ul|ol|table)/.test(b)) return b
      return '<p>' + b.replace(/\n/g, '<br>') + '</p>'
    }).join('')
}

export function ChatBubble({ role, content, coachKey }: { role: 'user' | 'assistant'; content: string; coachKey: 'N' | 'R' | 'S' | 'C' }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-white/8 rounded-xl px-4 py-2.5 max-w-[80%] text-sm text-white/90">{content}</div>
      </div>
    )
  }
  return (
    <div className="flex gap-2.5 items-start">
      <CoachAvatar coach={coachKey} />
      <div
        className="bg-white/5 border border-white/8 rounded-xl px-4 py-2.5 max-w-[85%] text-sm text-white/80 prose-chat flex-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
    </div>
  )
}

export function TypingIndicator({ coachKey }: { coachKey: 'N' | 'R' | 'S' | 'C' }) {
  return (
    <div className="flex gap-2.5 items-start">
      <CoachAvatar coach={coachKey} />
      <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

export function FlagBanner({ flags }: { flags: string[] }) {
  if (!flags.length) return null
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 space-y-1">
      {flags.map((f, i) => <div key={i} className="text-sm text-red-400">{f}</div>)}
    </div>
  )
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 p-1 rounded-lg mb-4">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            'flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all',
            active === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
