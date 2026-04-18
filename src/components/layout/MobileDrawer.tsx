'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  X, LayoutDashboard, MessageSquare, CheckSquare, FileText,
  Users, Euro, Activity, BookOpen, FolderOpen, Clock,
  Inbox, CalendarDays, Lightbulb, Brain, Search, History, Sparkles,
  HelpCircle, ShoppingCart, Upload
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DRAWER_GROUPS = [
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
      { href: '/journal',   label: 'Dagboek',     icon: BookOpen },
      { href: '/habits',    label: 'Gewoontes',   icon: Activity },
      { href: '/groceries', label: 'Boodschappen',icon: ShoppingCart },
    ],
  },
  {
    label: 'AI & Tools',
    items: [
      { href: '/chat',     label: 'Chat',        icon: MessageSquare },
      { href: '/patterns', label: 'Patronen',    icon: Brain },
      { href: '/memory',   label: 'Memory',      icon: Sparkles },
      { href: '/inbox',    label: 'Inbox',       icon: Inbox },
      { href: '/import',   label: 'Importeren',  icon: Upload },
      { href: '/timeline', label: 'Timeline',    icon: History },
      { href: '/uitleg',   label: 'Hoe werkt het?', icon: HelpCircle },
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
      <div className="absolute inset-0 glass-dark" onClick={onClose} />

      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 bg-surface-container-lowest rounded-t-3xl max-h-[85dvh] flex flex-col animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-outline-variant opacity-40" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-gradient" style={{ background: 'var(--gradient)' }}>
              D
            </div>
            <div>
              <p className="text-sm font-headline font-bold text-on-surface leading-tight">Daan</p>
              <p className="text-[10px] text-on-surface-variant leading-tight">Persoonlijke Hulp</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-4 pb-8 space-y-5">
          {DRAWER_GROUPS.map(group => (
            <div key={group.label}>
              <p className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                        active
                          ? 'bg-brand-subtle'
                          : 'hover:bg-surface-container'
                      )}
                    >
                      <span className={cn(active ? 'icon-gradient' : 'text-on-surface-variant')}>
                        <Icon size={16} strokeWidth={active ? 2.2 : 1.6} />
                      </span>
                      <span className={cn('font-medium', active ? 'text-gradient' : 'text-on-surface-variant')}>
                        {label}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}
