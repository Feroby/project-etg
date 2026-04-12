'use client'
import { ACCENT_TEXT, ACCENT_BG_SUBTLE, AccentColor } from './ui'

// Shared colour config — derived from design tokens in ui.tsx
const colorConfig = {
  green:  { dot: 'bg-etg-green',  num: 'bg-etg-green/20 text-etg-green' },
  amber:  { dot: 'bg-etg-amber',  num: 'bg-etg-amber/20 text-etg-amber' },
  blue:   { dot: 'bg-etg-blue',   num: 'bg-etg-blue/20 text-etg-blue' },
  purple: { dot: 'bg-etg-purple', num: 'bg-etg-purple/20 text-etg-purple' },
}

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }

function parseBlocks(raw: string): Block[] {
  const lines = raw.split('\n')
  const blocks: Block[] = []
  let bulletBuf: string[] = []
  let numBuf: string[] = []

  function flush() {
    if (bulletBuf.length) { blocks.push({ type: 'bullets', items: [...bulletBuf] }); bulletBuf = [] }
    if (numBuf.length) { blocks.push({ type: 'numbered', items: [...numBuf] }); numBuf = [] }
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (/^#{1,3}\s+/.test(line)) {
      flush(); blocks.push({ type: 'heading', text: line.replace(/^#{1,3}\s+/, '') })
    } else if (/^[-*]\s+/.test(line)) {
      numBuf.length && flush(); bulletBuf.push(line.replace(/^[-*]\s+/, ''))
    } else if (/^\d+\.\s+/.test(line)) {
      bulletBuf.length && flush(); numBuf.push(line.replace(/^\d+\.\s+/, ''))
    } else {
      flush()
      const last = blocks[blocks.length - 1]
      if (last?.type === 'paragraph') last.text += ' ' + line
      else blocks.push({ type: 'paragraph', text: line })
    }
  }
  flush()
  return blocks.filter(b => b.type !== 'paragraph' || (b as any).text.trim())
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-white">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

interface Props { text: string; color?: AccentColor }

export default function CoachResponse({ text, color = 'green' }: Props) {
  if (!text) return null
  const c = colorConfig[color]
  const blocks = parseBlocks(text)

  return (
    <div className={`mt-4 p-4 rounded-xl border ${ACCENT_TEXT[color].replace('text-', 'border-')}/20 ${ACCENT_BG_SUBTLE[color]}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${ACCENT_TEXT[color]}`}>
        Coach response
      </div>
      <div className="space-y-3">
        {blocks.map((block, i) => {
          if (block.type === 'heading') return (
            <div key={i} className={`text-xs font-bold uppercase tracking-wider pt-1 ${ACCENT_TEXT[color]}`}>
              {block.text}
            </div>
          )
          if (block.type === 'paragraph') return (
            <p key={i} className="text-sm text-white/85 leading-relaxed">
              <Inline text={block.text} />
            </p>
          )
          if (block.type === 'bullets') return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5 text-sm text-white/85">
                  <span className={`mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                  <span className="leading-relaxed"><Inline text={item} /></span>
                </li>
              ))}
            </ul>
          )
          if (block.type === 'numbered') return (
            <ol key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5 text-sm text-white/85">
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${c.num}`}>
                    {j + 1}
                  </span>
                  <span className="leading-relaxed"><Inline text={item} /></span>
                </li>
              ))}
            </ol>
          )
          return null
        })}
      </div>
    </div>
  )
}
