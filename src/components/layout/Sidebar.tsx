'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, CheckSquare, FileText,
  Users, Euro, Activity, BookOpen, FolderOpen, CalendarDays, Timer
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/worklog', label: 'Worklog', icon: Timer },
  { href: '/todos', label: 'Todos', icon: CheckSquare },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/contacts', label: 'Contacten', icon: Users },
  { href: '/finance', label: 'Financiën', icon: Euro },
  { href: '/habits', label: 'Gewoontes', icon: Activity },
  { href: '/journal', label: 'Dagboek', icon: BookOpen },
  { href: '/projects', label: 'Projecten', icon: FolderOpen },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-[#0a0c10] border-r border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-sm font-bold text-white">
            D
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Daan</p>
            <p className="text-[10px] text-slate-500 leading-tight">Persoonlijke Hulp</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                active
                  ? 'bg-brand-600/20 text-brand-400 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-white/5">
        <p className="text-[10px] text-slate-600">
          {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
    </aside>
  )
}
