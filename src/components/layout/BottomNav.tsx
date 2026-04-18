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
      <nav className="bottom-nav-glass fixed inset-x-3 bottom-3 z-50 flex items-end justify-around rounded-[28px] border border-black/5 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 md:hidden">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-[22px] px-3 py-2 transition-all duration-200',
                active
                  ? 'bg-[#202625] text-white shadow-[0_18px_40px_-26px_rgba(18,22,21,0.45)]'
                  : 'text-on-surface-variant'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn(
                'text-[9px] font-semibold uppercase tracking-[0.16em]',
                active ? 'text-white' : 'text-on-surface-variant'
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
            'flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-[22px] px-3 py-2 transition-all duration-200',
            drawerOpen ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant'
          )}
        >
          <MoreHorizontal size={20} strokeWidth={1.8} />
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant">Meer</span>
        </button>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
