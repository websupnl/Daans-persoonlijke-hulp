'use client'

import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 ml-[220px] overflow-auto bg-white">
        {children}
      </main>
    </div>
  )
}
