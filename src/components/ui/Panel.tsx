import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PanelTone = 'default' | 'muted' | 'accent' | 'inverse' | 'warning' | 'ai' | 'success'
type PanelPadding = 'sm' | 'md' | 'lg' | 'none'

const toneClasses: Record<PanelTone, string> = {
  default: 'card-base bg-surface',
  muted: 'border border-border bg-surface-inset',
  accent: 'card-accent',
  inverse: 'border border-text-primary bg-text-primary text-text-inverse',
  warning: 'card-warning',
  ai: 'card-ai',
  success: 'card-success',
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
        'rounded-lg',
        toneClasses[tone],
        paddingClasses[padding],
        interactive && 'cursor-pointer transition-all duration-base ease-calm hover:-translate-y-0.5 hover:shadow-sm',
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
        {eyebrow && <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{eyebrow}</p>}
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function AICard({
  label = 'AI Analyse',
  children,
  className,
  generatedAt,
  confidence,
}: {
  label?: string
  children: ReactNode
  className?: string
  generatedAt?: string
  confidence?: 'Hoog' | 'Gemiddeld' | 'Laag'
}) {
  return (
    <div className={cn('bg-ai-briefing rounded-lg border border-ai-muted border-l-[3px] border-l-ai p-5', className)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none text-ai">✦</span>
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
        </div>
        {confidence && (
          <span
            className={cn(
              'rounded-pill px-3 py-1 text-xs font-medium',
              confidence === 'Hoog' && 'bg-success-subtle text-success',
              confidence === 'Gemiddeld' && 'bg-warning-subtle text-warning',
              confidence === 'Laag' && 'bg-surface-inset text-text-secondary'
            )}
          >
            {confidence}
          </span>
        )}
      </div>
      <div className="text-base leading-7 text-text-primary">{children}</div>
      {generatedAt && <p className="mt-3 text-xs text-text-tertiary">Gegenereerd {generatedAt}</p>}
    </div>
  )
}

type InsightType = 'warning' | 'positive' | 'suggestion'

export function InsightBlock({
  type,
  title,
  detail,
  action,
  actionHref,
  className,
}: {
  type: InsightType
  title: string
  detail?: string
  action?: string
  actionHref?: string
  className?: string
}) {
  const icons: Record<InsightType, string> = {
    warning: '⚠',
    positive: '✦',
    suggestion: '💡',
  }
  const iconColors: Record<InsightType, string> = {
    warning: 'text-warning',
    positive: 'text-ai',
    suggestion: 'text-accent',
  }

  return (
    <div className={cn('flex items-start gap-3 border-b border-border py-3 last:border-0', className)}>
      <span className={cn('mt-0.5 shrink-0 text-base leading-none', iconColors[type])}>{icons[type]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-text-secondary">{detail}</p>}
        {action && actionHref && (
          <a href={actionHref} className="mt-1 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover">
            {action} →
          </a>
        )}
      </div>
    </div>
  )
}

export function StatStrip({
  stats,
  className,
}: {
  stats: Array<{
    label: string
    value: ReactNode
    meta?: ReactNode
    accent?: 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'orange' | 'pink'
  }>
  className?: string
}) {
  const accentColors: Record<string, string> = {
    blue: 'text-accent',
    violet: 'text-ai',
    green: 'text-success',
    red: 'text-error',
    amber: 'text-warning',
    orange: 'text-orange-500',
    pink: 'text-pink-500',
  }

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {stats.map((stat, i) => (
        <div key={i} className="card-base flex min-w-0 flex-col justify-center rounded-lg bg-surface px-4 py-4">
          <p className="truncate text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{stat.label}</p>
          <div className={cn('mt-2 text-2xl font-bold leading-none tracking-tight', stat.accent ? accentColors[stat.accent] : 'text-text-primary')}>
            {stat.value}
          </div>
          {stat.meta && <p className="mt-1 truncate text-xs text-text-secondary">{stat.meta}</p>}
        </div>
      ))}
    </div>
  )
}

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
      <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{title}</p>
      {action && <div className="text-xs text-text-secondary">{action}</div>}
    </div>
  )
}

export function MetricTile({
  label,
  value,
  meta,
  icon,
  trend,
  className,
}: {
  label: string
  value: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  trend?: 'up' | 'down' | 'flat'
  className?: string
}) {
  return (
    <div className={cn('card-base rounded-lg bg-surface p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">{label}</p>
          <div className="mt-2 flex items-end gap-1.5 text-2xl font-bold leading-none tracking-tight text-text-primary">
            {value}
            {trend === 'up' && <span className="mb-0.5 text-sm text-success">↑</span>}
            {trend === 'down' && <span className="mb-0.5 text-sm text-error">↓</span>}
            {trend === 'flat' && <span className="mb-0.5 text-sm text-text-tertiary">—</span>}
          </div>
          {meta && <div className="mt-1.5 text-xs text-text-secondary">{meta}</div>}
        </div>
        {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-text-secondary">{icon}</div>}
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
    <div className={cn('card-ghost rounded-lg bg-surface/50 px-5 py-8 text-center', className)}>
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">{description}</p>
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
  return <span className={cn('inline-flex items-center rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-text-secondary', className)}>{children}</span>
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-border', className)} />
}

export function SystemActionBubble({
  icon,
  title,
  detail,
  onUndo,
  undoLabel = 'Ongedaan maken',
  className,
}: {
  icon: ReactNode
  title: string
  detail?: string
  onUndo?: () => void
  undoLabel?: string
  className?: string
}) {
  return (
    <div className={cn('my-2 flex justify-center', className)}>
      <div className="flex max-w-[65%] items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3 shadow-xs">
        <span className="shrink-0 text-ai">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          {detail && <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>}
        </div>
        {onUndo && (
          <button onClick={onUndo} className="shrink-0 text-xs font-medium text-accent transition-colors hover:text-accent-hover">
            {undoLabel}
          </button>
        )}
      </div>
    </div>
  )
}
