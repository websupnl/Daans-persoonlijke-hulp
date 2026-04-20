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
    <div className="min-h-dvh bg-background text-text-primary">
      <Sidebar />

      <main className="min-h-dvh min-w-0 bg-background pb-[calc(72px+env(safe-area-inset-bottom))] md:ml-[var(--sidebar-w)] md:pb-0">
        <div className="min-h-dvh bg-background">
          {children}
        </div>
      </main>

      <BottomNav />

      {!isChat && (
        <Link
          href="/chat"
          className="focus-ring fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-pill bg-accent px-4 py-3 text-sm font-semibold text-text-inverse shadow-md transition-all duration-base ease-calm hover:-translate-y-0.5 hover:bg-accent-hover md:flex"
        >
          <span className="ai-pulse-dot h-2 w-2 rounded-full bg-white/70" />
          <MessageSquare size={16} />
          Chat
        </Link>
      )}
    </div>
  )
}
