'use client'

import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition-colors hover:border-pink-200 hover:text-gray-900"
          aria-label="Open navigatie"
        >
          <Menu size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-gradient">Daan</p>
          <p className="text-[10px] text-gray-400">Persoonlijke Hulp</p>
        </div>
        <div className="w-10" />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-gray-950/35 backdrop-blur-[1px] md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className="h-full w-[280px] max-w-[82vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-16 items-center justify-end px-4">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:border-pink-200 hover:text-gray-900"
                aria-label="Sluit navigatie"
              >
                <X size={18} />
              </button>
            </div>
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-[calc(100dvh-4rem)] md:min-h-dvh">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-white md:ml-[220px]">
        {children}
        </main>
      </div>
    </div>
  )
}
