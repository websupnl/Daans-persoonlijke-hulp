'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, CheckSquare, FileText,
  Users, Euro, Activity, BookOpen, FolderOpen, Clock, Inbox
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/todos', label: 'Todos', icon: CheckSquare },
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/contacts', label: 'Contacten', icon: Users },
  { href: '/finance', label: 'Financiën', icon: Euro },
  { href: '/habits', label: 'Gewoontes', icon: Activity },
  { href: '/journal', label: 'Dagboek', icon: BookOpen },
  { href: '/projects', label: 'Projecten', icon: FolderOpen },
  { href: '/worklogs', label: 'Werklog', icon: Clock },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-white border-r border-gray-100 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
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
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 group relative',
                active
                  ? 'bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50'
                  : 'hover:bg-gray-50'
              )}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
                />
              )}
              <span className={cn(
                'flex-shrink-0',
                active ? 'icon-gradient' : 'text-gray-400 group-hover:text-gray-600'
              )}>
                <Icon size={16} strokeWidth={active ? 2 : 1.5} />
              </span>
              <span className={cn(
                'font-medium',
                active ? 'text-gradient' : 'text-gray-500 group-hover:text-gray-700'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-[10px] text-gradient font-medium capitalize">
          {new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>
    </aside>
  )
}
