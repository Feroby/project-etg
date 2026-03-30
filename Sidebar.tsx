'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const nav = [
  { href: '/', label: 'Dashboard', icon: '⚡' },
  { href: '/nutrition', label: 'Nutrition', icon: '🥗', color: 'text-etg-green' },
  { href: '/recovery', label: 'Recovery', icon: '🔋', color: 'text-etg-amber' },
  { href: '/strength', label: 'Strength', icon: '🏋️', color: 'text-etg-blue' },
  { href: '/central', label: 'Central Coach', icon: '🧠', color: 'text-etg-purple' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
  { href: '/usage', label: 'API Usage', icon: '📊' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-[#0d0d0d] border-r border-white/8 flex flex-col z-50">
      <div className="p-5 border-b border-white/8">
        <div className="text-white font-semibold text-sm tracking-wide">PROJECT ETG</div>
        <div className="text-white/30 text-xs mt-0.5">Performance System</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
              path === item.href
                ? 'bg-white/10 text-white font-medium'
                : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            )}
          >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/8 space-y-2">
        <div className="text-[10px] text-white/20 uppercase tracking-wider">Week 1 · Squat Block</div>
        <button
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="text-[11px] text-white/20 hover:text-white/50 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
