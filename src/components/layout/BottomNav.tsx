'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, CheckSquare, Euro, Sparkles, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import MobileDrawer from './MobileDrawer'

const PRIMARY_NAV = [
  { href: '/',         label: 'Home',     icon: LayoutDashboard },
  { href: '/chat',     label: 'Chat',     icon: MessageSquare },
  { href: '/todos',    label: 'Taken',    icon: CheckSquare },
  { href: '/finance',  label: 'Financiën', icon: Euro },
  { href: '/patterns', label: 'AI',       icon: Sparkles },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <nav className="bottom-nav-glass fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-outline-variant px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1.5 md:hidden">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[52px] rounded-lg px-2 py-1.5 transition-all duration-150',
                active ? 'text-accent' : 'text-on-surface-variant'
              )}
            >
              <Icon
                size={21}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span className={cn(
                'text-[9px] font-semibold tracking-wide',
                active ? 'text-accent' : 'text-on-surface-variant'
              )}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
              )}
            </Link>
          )
        })}

        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 min-w-[52px] rounded-lg px-2 py-1.5 transition-all duration-150',
            drawerOpen ? 'text-accent' : 'text-on-surface-variant'
          )}
        >
          <MoreHorizontal size={21} strokeWidth={1.7} />
          <span className="text-[9px] font-semibold tracking-wide text-on-surface-variant">Meer</span>
        </button>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
