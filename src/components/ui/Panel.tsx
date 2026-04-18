import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PanelTone = 'default' | 'muted' | 'accent' | 'inverse' | 'warning'
type PanelPadding = 'sm' | 'md' | 'lg' | 'none'

const toneClasses: Record<PanelTone, string> = {
  default: 'bg-white border border-black/5 shadow-[0_2px_16px_-4px_rgba(31,37,35,0.10)]',
  muted: 'bg-surface-container-low border border-black/5',
  accent: 'bg-brand-subtle border border-black/5',
  inverse: 'bg-[#202625] text-white border border-black/10',
  warning: 'bg-[#fff7eb] border border-[#eed6b6]',
}

const paddingClasses: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Panel({
  children,
  className,
  tone = 'default',
  padding = 'md',
  interactive = false,
}: {
  children?: ReactNode
  className?: string
  tone?: PanelTone
  padding?: PanelPadding
  interactive?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-2xl',
        toneClasses[tone],
        paddingClasses[padding],
        interactive && 'cursor-pointer transition-colors duration-150 hover:bg-surface-container-lowest',
        className
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/60">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-0.5 text-base font-headline font-bold tracking-tight text-on-surface">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** StatStrip — horizontal stats row with dividers. Replaces grid of MetricTiles. */
export function StatStrip({
  stats,
  className,
}: {
  stats: Array<{
    label: string
    value: ReactNode
    meta?: ReactNode
    accent?: 'orange' | 'pink' | 'violet' | 'green' | 'red'
  }>
  className?: string
}) {
  const accentColors: Record<string, string> = {
    orange: 'text-orange-500',
    pink: 'text-pink-500',
    violet: 'text-violet-500',
    green: 'text-emerald-500',
    red: 'text-red-500',
  }
  return (
    <div className={cn('flex divide-x divide-black/6 overflow-hidden rounded-xl border border-black/5 bg-white', className)}>
      {stats.map((stat, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3.5">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/60">
            {stat.label}
          </p>
          <div className={cn(
            'mt-1 text-xl font-headline font-extrabold leading-none tracking-tight',
            stat.accent ? accentColors[stat.accent] : 'text-on-surface'
          )}>
            {stat.value}
          </div>
          {stat.meta && (
            <p className="mt-1 truncate text-[11px] text-on-surface-variant">{stat.meta}</p>
          )}
        </div>
      ))}
    </div>
  )
}

/** SectionHeader — label + optional action inside a panel */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
        {title}
      </p>
      {action && <div className="text-xs text-on-surface-variant">{action}</div>}
    </div>
  )
}

/** MetricTile — kept for backwards compat, use StatStrip for new code */
export function MetricTile({
  label,
  value,
  meta,
  icon,
  className,
}: {
  label: string
  value: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-black/5 bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/60">
            {label}
          </p>
          <div className="mt-1.5 text-xl font-headline font-extrabold leading-none tracking-tight text-on-surface">
            {value}
          </div>
          {meta && (
            <div className="mt-1 text-xs text-on-surface-variant">{meta}</div>
          )}
        </div>
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

export function EmptyPanel({
  title,
  description,
  action,
  className,
}: {
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-dashed border-black/10 bg-surface-container-low/50 px-5 py-8 text-center', className)}>
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-on-surface-variant">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ActionPill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-black/6 bg-white px-2.5 py-1 text-[11px] font-medium text-on-surface-variant', className)}>
      {children}
    </span>
  )
}

/** Divider — horizontal rule inside panels */
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-black/6', className)} />
}
