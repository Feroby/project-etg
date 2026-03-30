'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Incorrect username or password.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-etg-green/20 mb-4">
            <svg className="w-6 h-6 text-etg-green" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div className="text-white font-semibold tracking-wide">PROJECT ETG</div>
          <div className="text-white/30 text-sm mt-1">Performance coaching system</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="text-red-400 text-xs text-center py-1">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-etg-green hover:bg-etg-green/80 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition-all mt-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

      </div>
    </div>
  )
}
