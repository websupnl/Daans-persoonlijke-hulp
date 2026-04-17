'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, CheckSquare, FileText,
  Users, Euro, Activity, BookOpen, FolderOpen, Clock,
  Inbox, CalendarDays, Lightbulb, Brain, Search, History, Sparkles,
  HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_GROUPS = [
  {
    label: 'Overzicht',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays },
      { href: '/search', label: 'Zoeken', icon: Search },
    ],
  },
  {
    label: 'Werk',
    items: [
      { href: '/todos', label: 'Todos', icon: CheckSquare },
      { href: '/projects', label: 'Projecten', icon: FolderOpen },
      { href: '/worklogs', label: 'Werklog', icon: Clock },
      { href: '/notes', label: 'Notities', icon: FileText },
      { href: '/ideas', label: 'Ideeën', icon: Lightbulb },
    ],
  },
  {
    label: 'Financieel',
    items: [
      { href: '/finance', label: 'Financiën', icon: Euro },
      { href: '/contacts', label: 'Contacten', icon: Users },
    ],
  },
  {
    label: 'Persoonlijk',
    items: [
      { href: '/journal', label: 'Dagboek', icon: BookOpen },
      { href: '/habits', label: 'Gewoontes', icon: Activity },
    ],
  },
  {
    label: 'AI & Tools',
    items: [
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/patterns', label: 'Patronen', icon: Brain },
      { href: '/memory', label: 'Memory', icon: Sparkles },
      { href: '/inbox', label: 'Inbox', icon: Inbox },
      { href: '/timeline', label: 'Timeline', icon: History },
      { href: '/uitleg', label: 'Hoe werkt het?', icon: HelpCircle },
    ],
  },
]

export default function Sidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-gray-100 bg-white',
        mobile
          ? 'w-full rounded-r-[1.75rem] shadow-2xl'
          : 'fixed left-0 top-0 z-20 hidden h-dvh w-[220px] md:flex'
      )}
    >
      {/* Logo */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
          >
            D
          </div>
          <div>
            <p className="text-sm font-bold text-gradient leading-tight">Daan</p>
            <p className="text-[10px] text-gray-400 leading-tight">Persoonlijke Hulp</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[9px] font-bold uppercase tracking-widest text-gray-300">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150',
                      active
                        ? 'bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full"
                        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
                      />
                    )}
                    <span className={cn(
                      'flex-shrink-0',
                      active ? 'icon-gradient' : 'text-gray-400 group-hover:text-gray-600'
                    )}>
                      <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                    </span>
                    <span className={cn(
                      'text-sm font-medium',
                      active ? 'text-gradient' : 'text-gray-500 group-hover:text-gray-700'
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
      <div className="border-t border-gray-100 px-5 py-3">
        <p className="text-[10px] text-gradient font-semibold capitalize">
          {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
    </aside>
  )
}
