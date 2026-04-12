'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const nav = [
  { href: '/',           label: 'Dashboard',     icon: '⚡' },
  { href: '/nutrition',  label: 'Nutrition',      icon: '🥗' },
  { href: '/recovery',   label: 'Recovery',       icon: '🔋' },
  { href: '/strength',   label: 'Strength',       icon: '🏋️' },
  { href: '/central',    label: 'Central Coach',  icon: '🧠' },
  { href: '/settings',   label: 'Settings',       icon: '⚙️' },
  { href: '/usage',      label: 'API Usage',      icon: '📊' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-[#0d0d0d] border-r border-white/10 flex flex-col z-50">
      <div className="p-5 border-b border-white/10">
        <div className="text-white font-bold text-sm tracking-widest">PROJECT ETG</div>
        <div className="text-white/45 text-xs mt-0.5 font-medium">Performance System</div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5" aria-label="Main navigation">
        {nav.map(item => {
          const active = path === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-white/12 text-white'
                  : 'text-white/55 hover:text-white/85 hover:bg-white/6'
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-3">
        <div className="text-xs text-white/40 font-medium">Week 1 · Squat Block</div>
        <button
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="text-xs text-white/40 hover:text-white/70 transition-colors font-medium"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
