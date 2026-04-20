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
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
          title="Chat met AI"
        >
          <MessageSquare size={24} />
        </Link>
      )}
    </div>
  )
}
