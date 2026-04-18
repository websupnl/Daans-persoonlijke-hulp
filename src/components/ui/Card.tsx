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
        'overflow-hidden rounded-[28px] border border-black/5 bg-surface-container-lowest',
        compact ? 'p-3' : 'p-4',
        'shadow-[0_24px_60px_-36px_rgba(31,37,35,0.28)]',
        onClick && 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-38px_rgba(31,37,35,0.32)]',
        glow && onClick && 'hover:shadow-[0_28px_72px_-40px_rgba(90,103,123,0.34)]',
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
        'overflow-hidden rounded-[24px] border border-black/5 bg-surface-container-low/80',
        compact ? 'p-3' : 'p-4',
        onClick && 'cursor-pointer transition-all duration-200 hover:bg-surface-container hover:-translate-y-0.5',
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
    <div className={cn('rounded-[24px] border border-black/5 bg-surface-container-lowest p-3 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]', className)}>
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
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
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
