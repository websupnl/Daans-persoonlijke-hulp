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
      { href: '/chat',     label: 'Chat',          icon: MessageSquare },
      { href: '/patterns', label: 'Patronen',      icon: Brain },
      { href: '/memory',   label: 'Memory',        icon: Sparkles },
      { href: '/inbox',    label: 'Inbox',         icon: Inbox },
      { href: '/import',   label: 'Importeren',    icon: Upload },
      { href: '/timeline', label: 'Timeline',      icon: History },
      { href: '/uitleg',   label: 'Hoe werkt het?',icon: HelpCircle },
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
    <aside className="fixed left-0 top-0 z-20 hidden h-dvh w-[var(--sidebar-width)] p-4 md:flex">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-black/5 bg-surface-container-lowest shadow-[0_26px_70px_-40px_rgba(31,37,35,0.28)]">
        <div className="px-5 pb-5 pt-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold font-headline text-white shadow-[0_16px_32px_-18px_rgba(90,103,123,0.4)]"
              style={{ background: 'var(--gradient)' }}
            >
              D
            </div>
            <div>
              <p className="text-sm font-headline font-bold text-on-surface leading-tight">Daan</p>
              <p className="text-[11px] text-on-surface-variant leading-tight">Persoonlijke cockpit</p>
            </div>
          </div>
          <div className="mt-4 rounded-[22px] border border-black/5 bg-brand-subtle px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">Vandaag</p>
            <p className="mt-1 text-sm font-semibold text-on-surface capitalize">
              {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">
              Rustig overzicht, snelle acties en alle context op één plek.
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/70">
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
                      'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-150',
                      active
                        ? 'bg-brand-subtle shadow-[0_18px_40px_-32px_rgba(90,103,123,0.24)]'
                        : 'hover:bg-surface-container-low'
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
                        style={{ background: 'var(--gradient)' }}
                      />
                    )}
                    <span className={cn(
                      'flex-shrink-0',
                      active ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'
                    )}>
                      <Icon size={14} strokeWidth={active ? 2.2 : 1.6} />
                    </span>
                    <span className={cn(
                      'text-[13px] font-medium',
                      active ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'
                    )}>
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
        </nav>

        <div className="space-y-3 border-t border-black/5 px-4 py-4">
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 rounded-2xl bg-[#202625] px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
          >
            <MessageSquare size={14} />
            Open chat
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-black/5 bg-surface-container-low px-3 py-2.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <LogOut size={13} />
            {loggingOut ? 'Uitloggen...' : 'Uitloggen'}
          </button>
        </div>
      </div>
    </aside>
  )
}
