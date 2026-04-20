'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isChat = pathname === '/chat'

  return (
    <div className="min-h-dvh bg-background text-on-surface">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className={[
        'min-h-dvh min-w-0',
        'pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0',
        'md:ml-[var(--sidebar-width)]',
      ].join(' ')}>
        <div className="min-h-dvh">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Desktop: floating Chat button — only when not already on chat */}
      {!isChat && (
        <Link
          href="/chat"
          className="fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-xl md:flex focus-visible:shadow-focus"
        >
          <span className="h-2 w-2 rounded-full bg-white/60 ai-pulse-dot" />
          <MessageSquare size={16} />
          Chat
        </Link>
      )}
    </div>
  )
}
