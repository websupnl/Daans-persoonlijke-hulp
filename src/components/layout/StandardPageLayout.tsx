'use client'

/**
 * StandardPageLayout — backward-compatible wrapper around PageShell.
 * All existing modules keep working without changes.
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'

interface StandardPageLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

export default function StandardPageLayout({ title, subtitle, actions, children, className }: StandardPageLayoutProps) {
  return (
    <PageShell title={title} subtitle={subtitle} actions={actions} className={cn('max-w-5xl', className)}>
      {children}
    </PageShell>
  )
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60 font-headline px-0.5">{title}</h2>
          {action && <div className="text-xs text-on-surface-variant">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {children}
    </div>
  )
}

export function MainWithSidebar({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-1">{sidebar}</div>
      <div className="lg:col-span-3">{children}</div>
    </div>
  )
}
