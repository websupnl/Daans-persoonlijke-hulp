'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-dvh bg-background text-on-surface">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="min-h-dvh min-w-0 pb-[92px] md:ml-[var(--sidebar-width)] md:pb-0">
        <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.72),_rgba(246,243,237,1)_42%)]">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — hidden on md+ */}
      <BottomNav />

      {pathname !== '/chat' && (
        <Link
          href="/chat"
          className="fixed bottom-6 right-6 z-40 hidden items-center gap-2 rounded-full border border-black/5 bg-[#202625] px-4 py-3 text-sm font-semibold text-white shadow-[0_24px_50px_-28px_rgba(18,22,21,0.46)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2a3230] md:flex"
        >
          <span className="h-2 w-2 rounded-full bg-[#d8a26e]" />
          <MessageSquare size={16} />
          Chat
        </Link>
      )}
    </div>
  )
}
