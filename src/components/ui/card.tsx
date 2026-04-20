import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card-base rounded-lg bg-surface', className)}>{children}</div>
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5 pb-0', className)}>{children}</div>
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-md font-semibold text-text-primary', className)}>{children}</h3>
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-1 text-sm text-text-secondary', className)}>{children}</p>
}

export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  compact?: boolean
}

export function CardLow({ children, className, onClick, compact }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'overflow-hidden rounded-lg bg-surface-inset',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-colors duration-base ease-calm hover:bg-surface-hover',
        className
      )}
    >
      {children}
    </div>
  )
}

export function Row({
  children,
  className,
  onClick,
  active,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-fast ease-calm',
        active ? 'bg-surface-inset' : 'hover:bg-surface-hover',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

export function StatChip({
  label,
  value,
  sub,
  accent,
  className,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'blue' | 'violet' | 'green' | 'red' | 'amber'
  className?: string
}) {
  const accentClass: Record<string, string> = {
    blue: 'text-accent',
    violet: 'text-ai',
    green: 'text-success',
    red: 'text-error',
    amber: 'text-warning',
  }

  return (
    <div className={cn('card-base rounded-lg bg-surface px-3 py-3', className)}>
      <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold leading-none', accentClass[accent ?? ''] ?? 'text-text-primary')}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-text-secondary">{sub}</p>}
    </div>
  )
}

export function Tag({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'gray' | 'orange' | 'pink'
  className?: string
}) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
    violet: 'bg-ai-subtle text-ai',
    blue: 'bg-accent-subtle text-accent',
    green: 'bg-success-subtle text-success',
    red: 'bg-error-subtle text-error',
    amber: 'bg-warning-subtle text-warning',
    gray: 'bg-surface-inset text-text-secondary',
  }

  return (
    <span className={cn('inline-flex items-center rounded-pill px-2.5 py-1 text-2xs font-semibold', colors[color ?? 'gray'], className)}>
      {children}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: 'hoog' | 'medium' | 'laag' | string }) {
  const colors: Record<string, string> = {
    hoog: 'bg-error',
    medium: 'bg-warning',
    laag: 'bg-success',
  }

  return <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', colors[priority] ?? 'bg-border-strong')} />
}
