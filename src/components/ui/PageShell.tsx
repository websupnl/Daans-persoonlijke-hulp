/**
 * PageShell — consistent page wrapper for all module views.
 * Provides: header (title + subtitle + actions), content area with breathing room.
 * Used everywhere instead of StandardPageLayout.
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/Panel'

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
    <div className={cn('mx-auto w-full max-w-[1380px] px-4 sm:px-6 lg:px-8', compact ? 'py-5' : 'py-6 sm:py-8', className)}>
      <Panel tone="accent" padding="lg" className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/70">
              Persoonlijke werkruimte
            </p>
            <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant sm:text-[15px]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </Panel>

      <div className="space-y-5">
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
    <div className={cn('space-y-3', className)}>
      {title && (
        <div className="flex items-center justify-between px-1">
          <h2 className="font-headline text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/75">
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
