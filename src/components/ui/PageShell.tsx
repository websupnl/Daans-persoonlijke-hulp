import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageShellProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  compact?: boolean
}

export default function PageShell({ title, subtitle, actions, children, className, compact }: PageShellProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1380px] px-4 sm:px-6 lg:px-8', compact ? 'py-5' : 'py-6 sm:py-8', className)}>
      {/* Flat page header — geen card wrapper */}
      <div className="sticky top-0 z-10 -mx-4 -mt-0 mb-6 bg-background/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-outline-variant">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface sm:text-[28px]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-on-surface-variant">
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

      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

/** Section label + optional action */
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
            {title}
          </p>
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
