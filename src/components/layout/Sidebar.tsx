'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, CheckSquare, FileText,
  Users, Euro, Activity, BookOpen, FolderOpen, Clock,
  Inbox, CalendarDays, Lightbulb, Brain, Search, History, Sparkles,
  HelpCircle, ShoppingCart, LogOut, Upload
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const NAV_GROUPS = [
  {
    label: 'Overzicht',
    items: [
      { href: '/',       label: 'Dashboard',  icon: LayoutDashboard },
      { href: '/agenda', label: 'Agenda',      icon: CalendarDays },
      { href: '/search', label: 'Zoeken',      icon: Search },
    ],
  },
  {
    label: 'Werk',
    items: [
      { href: '/todos',    label: "Todo's",    icon: CheckSquare },
      { href: '/projects', label: 'Projecten', icon: FolderOpen },
      { href: '/worklogs', label: 'Werklog',   icon: Clock },
      { href: '/notes',    label: 'Notities',  icon: FileText },
      { href: '/ideas',    label: 'Ideeën',    icon: Lightbulb },
    ],
  },
  {
    label: 'Financieel',
    items: [
      { href: '/finance',  label: 'Financiën',  icon: Euro },
      { href: '/contacts', label: 'Contacten',  icon: Users },
    ],
  },
  {
    label: 'Persoonlijk',
    items: [
      { href: '/journal',   label: 'Dagboek',      icon: BookOpen },
      { href: '/habits',    label: 'Gewoontes',    icon: Activity },
      { href: '/groceries', label: 'Boodschappen', icon: ShoppingCart },
    ],
  },
  {
    label: 'AI & Tools',
    items: [
      { href: '/chat',     label: 'Chat',           icon: MessageSquare },
      { href: '/patterns', label: 'Patronen',       icon: Brain },
      { href: '/memory',   label: 'Memory',         icon: Sparkles },
      { href: '/inbox',    label: 'Inbox',          icon: Inbox },
      { href: '/import',   label: 'Importeren',     icon: Upload },
      { href: '/timeline', label: 'Timeline',       icon: History },
      { href: '/uitleg',   label: 'Hoe werkt het?', icon: HelpCircle },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

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
    <aside className="fixed left-0 top-0 z-20 hidden h-dvh w-[var(--sidebar-width)] md:flex">
      <div className="flex h-full w-full flex-col border-r border-black/6 bg-surface-container-lowest">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold font-headline text-white"
            style={{ background: 'var(--gradient)' }}
          >
            D
          </div>
          <div className="min-w-0">
            <p className="text-sm font-headline font-bold leading-tight text-on-surface">Daan</p>
            <p className="text-[11px] leading-tight text-on-surface-variant">
              {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>

        <div className="mx-4 border-t border-black/6" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-5">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/50">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => {
                    const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-100',
                          active
                            ? 'bg-surface-container text-on-surface'
                            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                        )}
                      >
                        <Icon
                          size={14}
                          strokeWidth={active ? 2.2 : 1.7}
                          className="shrink-0"
                        />
                        <span className={cn('text-[13px]', active ? 'font-semibold' : 'font-medium')}>
                          {label}
                        </span>
                        {active && (
                          <span
                            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: 'var(--gradient)' }}
                          />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-black/6 px-3 py-3 space-y-1.5">
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#202625] px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#2a3230]"
          >
            <MessageSquare size={13} />
            Open chat
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-black/5 bg-surface-container-low px-3 py-2 text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <LogOut size={12} />
            {loggingOut ? 'Uitloggen...' : 'Uitloggen'}
          </button>
        </div>
      </div>
    </aside>
  )
}
