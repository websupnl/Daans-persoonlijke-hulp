/**
 * PageShell — consistent page wrapper for all module views.
 * Provides: header (title + subtitle + actions), content area with breathing room.
 * Used everywhere instead of StandardPageLayout.
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageShellProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Tighter padding for dense modules */
  compact?: boolean
}

export default function PageShell({ title, subtitle, actions, children, className, compact }: PageShellProps) {
  return (
    <div className={cn('max-w-4xl mx-auto px-4 sm:px-6', compact ? 'py-4' : 'py-6', className)}>
      {/* Page header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="font-headline text-xl font-extrabold text-on-surface tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-on-surface-variant mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

/** Section within a page — title + content block, no lines */
export function PageSection({
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
    <div className={cn('space-y-2', className)}>
      {title && (
        <div className="flex items-center justify-between px-0.5">
          <h2 className="font-headline text-sm font-bold text-on-surface uppercase tracking-widest opacity-60">
            {title}
          </h2>
          {action && <div className="text-xs text-on-surface-variant">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

/** 2 or 4 column stats grid */
export function StatsRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 4 }) {
  return (
    <div className={cn('grid gap-3', cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}>
      {children}
    </div>
  )
}
