'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import { AIAssistantCommandCenter } from '@/components/ai/AIAssistantCommandCenter'

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

      <AIAssistantCommandCenter />
    </div>
  )
}
