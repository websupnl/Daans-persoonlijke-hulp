'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, BookOpen,
  CheckSquare, Euro, Brain,
  Sparkles, LogOut, ChevronDown,
  FileText, Users, Activity, FolderOpen, Clock,
  Inbox, CalendarDays, Lightbulb, Search, History,
  ShoppingCart, Upload, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const PRIMARY_NAV = [
  {
    label: 'Dagelijks',
    items: [
      { href: '/',        label: 'Dashboard', icon: LayoutDashboard },
      { href: '/chat',    label: 'Chat',       icon: MessageSquare },
      { href: '/journal', label: 'Dagboek',    icon: BookOpen },
    ],
  },
  {
    label: 'Bijhouden',
    items: [
      { href: '/todos',   label: 'Taken',     icon: CheckSquare },
      { href: '/finance', label: 'Financiën', icon: Euro },
      { href: '/memory',  label: 'Geheugen',  icon: Brain },
    ],
  },
  {
    label: 'Intelligentie',
    items: [
      { href: '/patterns', label: 'Inzichten', icon: Sparkles },
    ],
  },
]

const MORE_NAV = [
  { href: '/notes',     label: 'Notities',     icon: FileText },
  { href: '/projects',  label: 'Projecten',    icon: FolderOpen },
  { href: '/worklogs',  label: 'Werklog',      icon: Clock },
  { href: '/habits',    label: 'Gewoontes',    icon: Activity },
  { href: '/contacts',  label: 'Contacten',    icon: Users },
  { href: '/agenda',    label: 'Agenda',       icon: CalendarDays },
  { href: '/ideas',     label: 'Ideeën',       icon: Lightbulb },
  { href: '/groceries', label: 'Boodschappen', icon: ShoppingCart },
  { href: '/inbox',     label: 'Inbox',        icon: Inbox },
  { href: '/search',    label: 'Zoeken',       icon: Search },
  { href: '/timeline',  label: 'Timeline',     icon: History },
  { href: '/import',    label: 'Importeren',   icon: Upload },
]

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100',
        active
          ? 'bg-accent-light text-accent font-semibold'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium'
      )}
    >
      {active && <span className="nav-active-indicator" />}
      <Icon
        size={15}
        strokeWidth={active ? 2.2 : 1.8}
        className="shrink-0"
      />
      <span className="text-[13px] truncate">{label}</span>
    </Link>
  )
}

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [loggingOut, setLoggingOut] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = MORE_NAV.some(item =>
    item.href !== '/' && pathname.startsWith(item.href)
  )

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
    <aside className="fixed left-0 top-0 z-20 hidden h-dvh w-[var(--sidebar-width)] md:flex flex-col">
      <div className="flex h-full w-full flex-col bg-white border-r border-outline-variant">

        {/* Header — logo + user */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white bg-gradient">
            D
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-on-surface">Daan</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success ai-pulse-dot" />
              <p className="text-[11px] leading-tight text-on-surface-variant">AI actief</p>
            </div>
          </div>
        </div>

        <div className="mx-4 h-px bg-outline-variant" />

        {/* Primary navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {PRIMARY_NAV.map(group => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/50">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavItem key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}

          {/* More — collapsible */}
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/50">
              Meer
            </p>
            <button
              onClick={() => setMoreOpen(v => !v)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-all duration-100',
                moreActive && !moreOpen
                  ? 'bg-accent-light text-accent font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium'
              )}
            >
              <Settings size={15} strokeWidth={1.8} className="shrink-0" />
              <span className="text-[13px] flex-1 text-left">Alle modules</span>
              <ChevronDown
                size={13}
                className={cn('shrink-0 transition-transform duration-200', moreOpen && 'rotate-180')}
              />
            </button>

            {moreOpen && (
              <div className="mt-1 space-y-0.5 animate-fade-in">
                {MORE_NAV.map(item => (
                  <NavItem key={item.href} {...item} />
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-outline-variant px-3 py-3 space-y-1.5">
          <Link
            href="/chat"
            className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-accent-hover focus-visible:shadow-focus"
          >
            <MessageSquare size={14} />
            Open Chat
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
          >
            <LogOut size={13} />
            {loggingOut ? 'Uitloggen...' : 'Uitloggen'}
          </button>
        </div>
      </div>
    </aside>
  )
}
