'use client'

import Sidebar from './Sidebar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
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
    </div>
  )
}
