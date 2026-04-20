'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MORE_ITEMS, PRIMARY_GROUPS } from './navigation'

export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[8px]" onClick={onClose} />

      <div className="card-raised absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[20px] bg-surface animate-slide-up">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-8 rounded-full bg-border-strong" />
        </div>

        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold text-text-inverse">
              D
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-text-primary">Daan&apos;s Persoonlijke Hulp</p>
              <p className="text-xs leading-tight text-text-secondary">Daan · AI actief</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4">
          {[...PRIMARY_GROUPS, { label: 'Meer', items: MORE_ITEMS }].map(group => (
            <div key={group.label}>
              <p className="mb-1 px-2 text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                {group.label}
              </p>
              <div className="space-y-0.5 pb-4 pt-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-fast ease-calm',
                        active
                          ? 'bg-accent-subtle font-semibold text-accent'
                          : 'font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary'
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

        <div className="h-[calc(env(safe-area-inset-bottom)+1rem)]" />
      </div>
    </div>
  )
}
