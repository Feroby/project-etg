'use client'
import { useState, useRef, useEffect } from 'react'
import { ChatBubble, TypingIndicator, Spinner } from './ui'

type Coach = 'nutrition' | 'recovery' | 'strength' | 'central'
type Message = { role: 'user' | 'assistant'; content: string }

const coachKeys: Record<Coach, 'N' | 'R' | 'S' | 'C'> = {
  nutrition: 'N', recovery: 'R', strength: 'S', central: 'C'
}

const placeholders: Record<Coach, string> = {
  nutrition: 'Ask about your macros, meal timing, weight trends...',
  recovery: 'Ask about your HRV, sleep quality, readiness...',
  strength: 'Ask about programming, technique, progression...',
  central: 'Ask about patterns across all domains, priorities, decisions...',
}

export default function ChatInterface({ coach, initialMessages }: { coach: Coach; initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const updated = [...messages, { role: 'user' as const, content: text }]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach, messages: updated }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function autosize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-white/20 text-sm pt-12">
            Start a conversation with your {coach} coach
          </div>
        )}
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} coachKey={coachKeys[coach]} />
        ))}
        {loading && <TypingIndicator coachKey={coachKeys[coach]} />}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/8 p-3">
        <div className="flex gap-2 items-end bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => { setInput(e.target.value); autosize(e.target) }}
            onKeyDown={handleKey}
            placeholder={placeholders[coach]}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none resize-none max-h-32"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-7 h-7 bg-white/20 hover:bg-white/30 disabled:opacity-30 rounded-lg flex items-center justify-center transition-all"
          >
            {loading ? <Spinner size="sm" /> : <span className="text-xs">↗</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
