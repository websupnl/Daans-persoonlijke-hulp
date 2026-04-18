'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, CheckSquare, CalendarDays, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import MobileDrawer from './MobileDrawer'

const PRIMARY_NAV = [
  { href: '/',       label: 'Home',   icon: LayoutDashboard },
  { href: '/todos',  label: "Todo's", icon: CheckSquare },
  { href: '/chat',   label: 'Chat',   icon: MessageSquare },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <nav className="bottom-nav-glass md:hidden fixed bottom-0 inset-x-0 z-50 flex items-end justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2 rounded-t-3xl">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-200 min-w-[56px]',
                active
                  ? 'bg-brand-subtle text-transparent [&_svg]:stroke-[url(#grad)]'
                  : 'text-on-surface-variant'
              )}
            >
              {/* Gradient def for active icons */}
              <svg width="0" height="0" className="absolute">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#f97316" />
                    <stop offset="50%"  stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
              </svg>
              <span className={cn(active && 'icon-gradient')}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
              </span>
              <span className={cn(
                'text-[9px] font-semibold uppercase tracking-widest',
                active ? 'text-gradient' : 'text-on-surface-variant'
              )}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* More button → full nav drawer */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-2xl transition-all duration-200 min-w-[56px]',
            drawerOpen ? 'bg-brand-subtle' : 'text-on-surface-variant'
          )}
        >
          <MoreHorizontal size={20} strokeWidth={1.6} />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant">Meer</span>
        </button>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
