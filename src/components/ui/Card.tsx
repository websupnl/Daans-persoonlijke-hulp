import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  compact?: boolean
}

/** Card — main container, used sparingly for elevated content blocks */
export function Card({ children, className, onClick, compact }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'overflow-hidden rounded-xl border border-black/5 bg-white',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-colors duration-150 hover:bg-surface-container-lowest',
        className
      )}
    >
      {children}
    </div>
  )
}

/** CardLow — secondary card for nested content */
export function CardLow({ children, className, onClick, compact }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'overflow-hidden rounded-lg border border-black/5 bg-surface-container-low',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-colors duration-150 hover:bg-surface-container',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Row — clean list item. Use instead of CardLow for repeating list items. */
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

/** StatChip — compact metric bubble */
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
  accent?: 'orange' | 'pink' | 'violet' | 'green' | 'red'
  className?: string
}) {
  const accentClass = {
    orange: 'text-orange-500',
    pink: 'text-pink-500',
    violet: 'text-violet-500',
    green: 'text-emerald-500',
    red: 'text-red-500',
  }[accent ?? 'pink'] ?? 'text-on-surface'

  return (
    <div className={cn('rounded-lg border border-black/5 bg-white px-3 py-2.5', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/60">{label}</p>
      <p className={cn('mt-0.5 text-xl font-headline font-extrabold leading-none', accentClass)}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-on-surface-variant">{sub}</p>}
    </div>
  )
}

/** Tag / pill */
export function Tag({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: 'orange' | 'pink' | 'violet' | 'green' | 'red' | 'gray' | 'blue'
  className?: string
}) {
  const colors = {
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-surface-container text-on-surface-variant',
    blue: 'bg-blue-50 text-blue-600',
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

/** Priority dot */
export function PriorityDot({ priority }: { priority: 'hoog' | 'medium' | 'laag' | string }) {
  const colors: Record<string, string> = {
    hoog: 'bg-red-400',
    medium: 'bg-amber-400',
    laag: 'bg-emerald-400',
  }
  return <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', colors[priority] ?? 'bg-outline-variant')} />
}
