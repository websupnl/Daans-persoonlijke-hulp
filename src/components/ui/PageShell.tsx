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
    <div className={cn('mx-auto w-full max-w-content px-4 sm:px-6 lg:px-6', compact ? 'py-5' : 'py-6 sm:py-6', className)}>
      <div className="page-shell-header sticky top-0 z-10 -mx-4 mb-6 flex flex-col gap-3 px-4 pb-4 pt-5 sm:-mx-6 sm:px-6 lg:px-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-text-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  )
}

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
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{title}</p>
          {action && <div className="text-xs text-text-secondary">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export function StatsRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 4 }) {
  return <div className={cn('grid gap-3', cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2')}>{children}</div>
}
