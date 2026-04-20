'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import MobileDrawer from './MobileDrawer'
import { MOBILE_PRIMARY_ITEMS } from './navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <nav className="bottom-nav-glass fixed inset-x-0 bottom-0 z-50 flex items-start justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5 md:hidden">
        {MOBILE_PRIMARY_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-fast ease-calm',
                active ? 'text-accent' : 'text-text-secondary'
              )}
            >
              {active && (
                <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" />
              )}
              <Icon size={href === '/chat' ? 24 : 22} strokeWidth={active ? 2.2 : 1.8} />
              <span
                className={cn(
                  'text-[10px] font-semibold tracking-[0.08em] transition-all duration-fast',
                  active && href === '/chat' && 'sr-only',
                  active ? 'text-accent' : 'text-text-secondary'
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}

        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            'relative flex min-w-[56px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-all duration-fast ease-calm',
            drawerOpen ? 'text-accent' : 'text-text-secondary'
          )}
        >
          {drawerOpen && (
            <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-accent" />
          )}
          <MoreHorizontal size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold tracking-[0.08em]">···</span>
        </button>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
