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
    <aside className="fixed left-0 top-0 z-20 hidden h-dvh w-[220px] flex-col bg-surface-container-low md:flex">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold font-headline text-white"
            style={{ background: 'var(--gradient)' }}
          >
            D
          </div>
          <div>
            <p className="text-sm font-headline font-bold text-gradient leading-tight">Daan</p>
            <p className="text-[10px] text-on-surface-variant leading-tight">Persoonlijke Hulp</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant opacity-50">
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
                      'group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-150',
                      active
                        ? 'bg-brand-subtle'
                        : 'hover:bg-surface-container'
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full"
                        style={{ background: 'var(--gradient)' }}
                      />
                    )}
                    <span className={cn(
                      'flex-shrink-0',
                      active ? 'icon-gradient' : 'text-on-surface-variant group-hover:text-on-surface'
                    )}>
                      <Icon size={14} strokeWidth={active ? 2.2 : 1.6} />
                    </span>
                    <span className={cn(
                      'text-[13px] font-medium',
                      active ? 'text-gradient' : 'text-on-surface-variant group-hover:text-on-surface'
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

      {/* Bottom */}
      <div className="px-4 py-4 space-y-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-container px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
        >
          <LogOut size={13} />
          {loggingOut ? 'Uitloggen...' : 'Uitloggen'}
        </button>
        <p className="text-[10px] text-gradient font-semibold capitalize text-center">
          {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
    </aside>
  )
}
