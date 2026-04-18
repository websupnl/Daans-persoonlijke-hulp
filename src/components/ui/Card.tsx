/**
 * Card primitives — Ethereal style.
 * No borders. Elevation through background tonal shift + ambient shadow.
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  /** Click handler — adds hover cursor + scale */
  onClick?: () => void
  /** Accent gradient glow on hover */
  glow?: boolean
  /** Low = surface-container-low bg (for nesting inside cards) */
  low?: boolean
  /** Compact inner padding */
  compact?: boolean
}

/** Main card — white bg, ambient shadow */
export function Card({ children, className, onClick, glow, compact }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-container-lowest rounded-2xl overflow-hidden',
        compact ? 'p-3' : 'p-4',
        'shadow-ambient-xs',
        onClick && 'cursor-pointer transition-all duration-150 hover:shadow-ambient-sm',
        glow && onClick && 'hover:shadow-[0_8px_32px_-4px_rgba(236,72,153,0.10)]',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Low card — surface-container-low bg, no shadow (for nested content) */
export function CardLow({ children, className, onClick, compact }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-surface-container-low rounded-2xl overflow-hidden',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-colors duration-150 hover:bg-surface-container',
        className
      )}
    >
      {children}
    </div>
  )
}

/** Stat chip — small metric display */
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
    pink:   'text-pink-500',
    violet: 'text-violet-500',
    green:  'text-emerald-500',
    red:    'text-red-500',
  }[accent ?? 'pink'] ?? 'text-on-surface'

  return (
    <div className={cn('bg-surface-container-lowest rounded-xl p-3 shadow-ambient-xs', className)}>
      <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">{label}</p>
      <p className={cn('text-2xl font-headline font-extrabold mt-1 leading-none', accentClass)}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-on-surface-variant mt-1">{sub}</p>}
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
    orange: 'bg-orange-100 text-orange-700',
    pink:   'bg-pink-100 text-pink-700',
    violet: 'bg-violet-100 text-violet-700',
    green:  'bg-emerald-100 text-emerald-700',
    red:    'bg-red-100 text-red-700',
    gray:   'bg-surface-container text-on-surface-variant',
    blue:   'bg-blue-100 text-blue-700',
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
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
    hoog:   'bg-red-400',
    medium: 'bg-amber-400',
    laag:   'bg-emerald-400',
  }
  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full', colors[priority] ?? 'bg-outline-variant')} />
}
