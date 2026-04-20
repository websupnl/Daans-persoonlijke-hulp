'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FOOTER_ITEMS, MORE_ITEMS, PRIMARY_GROUPS } from './navigation'

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-4 py-2.5 text-sm transition-all duration-fast ease-calm',
        active
          ? 'bg-accent-subtle font-semibold text-accent'
          : 'font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary'
      )}
    >
      {active && <span className="nav-active-indicator" />}
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = MORE_ITEMS.some(item => item.href !== '/' && pathname.startsWith(item.href))

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.replace('/login')
      router.refresh()
      setLoggingOut(false)
    }
  }

  return (
    <aside className="fixed left-0 top-0 z-20 hidden h-dvh w-[var(--sidebar-w)] md:flex">
      <div className="flex h-full w-full flex-col border-r border-border bg-surface">
        <div className="flex min-h-[72px] items-center gap-3 px-5 py-5">
          <div className="bg-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-text-inverse shadow-xs">
            D
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight text-text-primary">Daan</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="ai-pulse-dot h-2 w-2 rounded-full bg-success" />
              <p className="text-xs leading-tight text-text-secondary">AI actief</p>
            </div>
          </div>
        </div>

        <div className="mx-5 h-px bg-border" />

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-6">
            {PRIMARY_GROUPS.map(group => (
              <div key={group.label}>
                <p className="mb-1 px-4 text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {group.label}
                </p>
                <div className="space-y-0.5 pt-1">
                  {group.items.map(item => (
                    <NavItem key={item.href} {...item} />
                  ))}
                </div>
              </div>
            ))}

            <div>
              <div className="mx-4 mb-3 h-px bg-border" />
              <button
                onClick={() => setMoreOpen(v => !v)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm transition-all duration-base ease-calm',
                  moreActive || moreOpen
                    ? 'bg-surface-hover text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <Sparkles size={16} className="shrink-0" />
                <span className="flex-1 text-left font-medium">Overige modules</span>
                <ChevronDown
                  size={14}
                  className={cn('shrink-0 transition-transform duration-base ease-calm', moreOpen && 'rotate-180')}
                />
              </button>
              <p className="mt-2 px-4 text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                Meer
              </p>
              {moreOpen && (
                <div className="mt-1 space-y-0.5 animate-slide-up">
                  {MORE_ITEMS.map(item => (
                    <NavItem key={item.href} {...item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="border-t border-border px-3 py-3">
          <div className="space-y-1">
            {FOOTER_ITEMS.map(item => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-2 flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-fast ease-calm hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
          >
            <LogOut size={16} />
            {loggingOut ? 'Uitloggen...' : 'Uitloggen'}
          </button>
        </div>
      </div>
    </aside>
  )
}
