import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Shadcn-compatible exports (used by admin pages) ───────────────────────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-outline-variant bg-white shadow-sm', className)}>
      {children}
    </div>
  )
}
export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5 pb-0', className)}>{children}</div>
}
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-[15px] font-semibold text-on-surface', className)}>{children}</h3>
}
export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-1 text-[13px] text-on-surface-variant', className)}>{children}</p>
}
export function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('p-5', className)}>{children}</div>
}

// ── CardLow ───────────────────────────────────────────────────────────────────

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
        'overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-colors duration-150 hover:bg-surface-container',
        className
      )}
    >
      {children}
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

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
        'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors duration-100',
        active ? 'bg-surface-container-low' : 'hover:bg-surface-container-low/70',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

// ── StatChip ──────────────────────────────────────────────────────────────────

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
    blue:   'text-accent',
    violet: 'text-ai-purple',
    green:  'text-success',
    red:    'text-danger',
    amber:  'text-warning',
  }

  return (
    <div className={cn('rounded-lg border border-outline-variant bg-white px-3 py-2.5', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/60">{label}</p>
      <p className={cn('mt-0.5 text-xl font-bold leading-none', accentClass[accent ?? ''] ?? 'text-on-surface')}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-on-surface-variant">{sub}</p>}
    </div>
  )
}

// ── Tag ───────────────────────────────────────────────────────────────────────

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
    pink:   'bg-pink-50 text-pink-600',
    violet: 'bg-ai-purple-bg text-ai-purple',
    blue:   'bg-accent-light text-accent',
    green:  'bg-success-bg text-success',
    red:    'bg-danger-bg text-danger',
    amber:  'bg-warning-bg text-warning',
    gray:   'bg-surface-container text-on-surface-variant',
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
      colors[color ?? 'gray'],
      className
    )}>
      {children}
    </span>
  )
}

// ── PriorityDot ───────────────────────────────────────────────────────────────

export function PriorityDot({ priority }: { priority: 'hoog' | 'medium' | 'laag' | string }) {
  const colors: Record<string, string> = {
    hoog:   'bg-danger',
    medium: 'bg-warning',
    laag:   'bg-success',
  }
  return (
    <span className={cn(
      'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
      colors[priority] ?? 'bg-outline-variant'
    )} />
  )
}
