'use client'

import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0f1117]">
      <Sidebar />
      <main className="flex-1 ml-[220px] overflow-auto">
        {children}
      </main>
    </div>
  )
}
