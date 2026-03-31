'use client'

// Parses and renders AI coach output with clean formatting
// Handles: headers, bold, bullet lists, numbered lists, plain paragraphs

interface Props {
  text: string
  color?: 'green' | 'amber' | 'blue' | 'purple'
}

const colorMap = {
  green: { border: 'border-etg-green/20', bg: 'bg-etg-green/10', label: 'text-etg-green', accent: 'bg-etg-green/20 text-etg-green' },
  amber: { border: 'border-etg-amber/20', bg: 'bg-etg-amber/10', label: 'text-etg-amber', accent: 'bg-etg-amber/20 text-etg-amber' },
  blue: { border: 'border-etg-blue/20', bg: 'bg-etg-blue/10', label: 'text-etg-blue', accent: 'bg-etg-blue/20 text-etg-blue' },
  purple: { border: 'border-etg-purple/20', bg: 'bg-etg-purple/10', label: 'text-etg-purple', accent: 'bg-etg-purple/20 text-etg-purple' },
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
      flush()
      blocks.push({ type: 'heading', text: line.replace(/^#{1,3}\s+/, '') })
    } else if (/^[-*]\s+/.test(line)) {
      numBuf.length && flush()
      bulletBuf.push(line.replace(/^[-*]\s+/, ''))
    } else if (/^\d+\.\s+/.test(line)) {
      bulletBuf.length && flush()
      numBuf.push(line.replace(/^\d+\.\s+/, ''))
    } else {
      flush()
      // Merge with previous paragraph if last block was one
      const last = blocks[blocks.length - 1]
      if (last?.type === 'paragraph') {
        last.text += ' ' + line
      } else {
        blocks.push({ type: 'paragraph', text: line })
      }
    }
  }
  flush()
  return blocks.filter(b => b.type !== 'paragraph' || (b as any).text.trim())
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-medium text-white">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

export default function CoachResponse({ text, color = 'green' }: Props) {
  if (!text) return null
  const c = colorMap[color]
  const blocks = parseBlocks(text)

  return (
    <div className={`mt-4 p-4 rounded-xl border ${c.border} ${c.bg}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-widest mb-3 ${c.label}`}>
        Coach response
      </div>
      <div className="space-y-2.5">
        {blocks.map((block, i) => {
          if (block.type === 'heading') {
            return (
              <div key={i} className={`text-xs font-semibold uppercase tracking-wider pt-1 ${c.label}`}>
                {block.text}
              </div>
            )
          }
          if (block.type === 'paragraph') {
            return (
              <p key={i} className="text-sm text-white/80 leading-relaxed">
                {renderInline(block.text)}
              </p>
            )
          }
          if (block.type === 'bullets') {
            return (
              <ul key={i} className="space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-white/80">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.accent.split(' ')[0]}`} />
                    <span className="leading-relaxed">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            )
          }
          if (block.type === 'numbered') {
            return (
              <ol key={i} className="space-y-1.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm text-white/80">
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold mt-0.5 ${c.accent}`}>
                      {j + 1}
                    </span>
                    <span className="leading-relaxed">{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
