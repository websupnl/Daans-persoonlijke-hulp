'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="min-w-0 min-h-dvh md:ml-[220px] pb-[80px] md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav — hidden on md+ */}
      <BottomNav />

      {pathname !== '/chat' && (
        <Link
          href="/chat"
          className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          style={{ background: 'var(--gradient)' }}
        >
          <MessageSquare size={16} />
          Chat
        </Link>
      )}
    </div>
  )
}
