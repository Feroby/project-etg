import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Project ETG',
  description: 'Multi-coach AI performance system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a]">{children}</body>
    </html>
  )
}
