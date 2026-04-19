'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  X, LayoutDashboard, MessageSquare, CheckSquare, FileText,
  Users, Euro, Activity, BookOpen, FolderOpen, Clock,
  Inbox, CalendarDays, Lightbulb, Brain, Search, History, Sparkles,
  ShoppingCart, Upload, Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DRAWER_GROUPS = [
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
  {
    label: 'Meer',
    items: [
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
    ],
  },
]

export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 glass-dark"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] flex flex-col rounded-t-2xl bg-white animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-surface-container-high" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white bg-gradient">
              D
            </div>
            <div>
              <p className="text-[13px] font-semibold text-on-surface leading-tight">Daan</p>
              <p className="text-[11px] text-on-surface-variant leading-tight">Persoonlijke cockpit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {DRAWER_GROUPS.map(group => (
            <div key={group.label}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/60">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-all',
                        active
                          ? 'bg-accent-light text-accent font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-medium'
                      )}
                    >
                      <Icon size={15} strokeWidth={active ? 2.2 : 1.7} />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Safe area bottom */}
        <div className="h-[calc(env(safe-area-inset-bottom)+1rem)]" />
      </div>
    </div>
  )
}
