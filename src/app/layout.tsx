import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Daan's Persoonlijke Hulp",
  description: 'Jouw persoonlijke levens-OS',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
