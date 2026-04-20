import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Panel ─────────────────────────────────────────────────────────────────────

type PanelTone = 'default' | 'muted' | 'accent' | 'inverse' | 'warning' | 'ai' | 'success'
type PanelPadding = 'sm' | 'md' | 'lg' | 'none'

const toneClasses: Record<PanelTone, string> = {
  default: 'bg-white border border-outline-variant shadow-sm',
  muted:   'bg-surface-container-low border border-outline-variant',
  accent:  'bg-brand-subtle border border-accent/10',
  inverse: 'bg-on-surface text-white border border-on-surface',
  warning: 'bg-warning-bg border border-warning-border',
  ai:      'ai-card',
  success: 'bg-success-bg border border-success/20',
}

const paddingClasses: Record<PanelPadding, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
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
        'rounded-xl',
        toneClasses[tone],
        paddingClasses[padding],
        interactive && 'cursor-pointer transition-all duration-150 card-hover',
        className
      )}
    >
      {children}
    </section>
  )
}

// ── PanelHeader ───────────────────────────────────────────────────────────────

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
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant/60">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight text-on-surface">
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

// ── AICard ────────────────────────────────────────────────────────────────────
// Purple-accented card for AI-generated content

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
    <div className={cn('ai-card p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-ai-purple text-base leading-none">✦</span>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ai-purple">
            {label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confidence && (
            <span className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full',
              confidence === 'Hoog'      ? 'bg-success-bg text-success' :
              confidence === 'Gemiddeld' ? 'bg-warning-bg text-warning' :
                                           'bg-surface-container text-on-surface-variant'
            )}>
              {confidence}
            </span>
          )}
        </div>
      </div>
      <div className="text-[14px] leading-7 text-on-surface">
        {children}
      </div>
      {generatedAt && (
        <p className="mt-3 text-[11px] text-on-surface-variant/60">
          Gegenereerd {generatedAt}
        </p>
      )}
    </div>
  )
}

// ── InsightBlock ──────────────────────────────────────────────────────────────
// A single detected pattern / insight row

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
    warning:    '⚠',
    positive:   '✦',
    suggestion: '💡',
  }
  const iconColors: Record<InsightType, string> = {
    warning:    'text-warning',
    positive:   'text-ai-purple',
    suggestion: 'text-accent',
  }

  return (
    <div className={cn(
      'flex items-start gap-3 py-3 border-b border-outline-variant last:border-0',
      className
    )}>
      <span className={cn('text-base leading-none shrink-0 mt-0.5', iconColors[type])}>
        {icons[type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-on-surface">{title}</p>
        {detail && (
          <p className="mt-0.5 text-[12px] text-on-surface-variant">{detail}</p>
        )}
        {action && actionHref && (
          <a
            href={actionHref}
            className="mt-1 inline-block text-[12px] font-medium text-accent hover:text-accent-hover transition-colors"
          >
            {action} →
          </a>
        )}
      </div>
    </div>
  )
}

// ── StatStrip ─────────────────────────────────────────────────────────────────

export function StatStrip({
  stats,
  className,
}: {
  stats: Array<{
    label: string
    value: ReactNode
    meta?: ReactNode
    accent?: 'blue' | 'violet' | 'green' | 'red' | 'amber' | 'orange'
  }>
  className?: string
}) {
  const accentColors: Record<string, string> = {
    blue:   'text-accent',
    violet: 'text-ai-purple',
    green:  'text-success',
    red:    'text-danger',
    amber:  'text-warning',
    orange: 'text-orange-500',
  }

  return (
    <div className={cn(
      'flex divide-x divide-outline-variant overflow-hidden rounded-xl border border-outline-variant bg-white',
      className
    )}>
      {stats.map((stat, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3.5">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/60">
            {stat.label}
          </p>
          <div className={cn(
            'mt-1 text-xl font-bold leading-none tracking-tight',
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

// ── SectionHeader ─────────────────────────────────────────────────────────────

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
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/60">
        {title}
      </p>
      {action && <div className="text-xs text-on-surface-variant">{action}</div>}
    </div>
  )
}

// ── MetricTile ────────────────────────────────────────────────────────────────

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
    <div className={cn('rounded-lg border border-outline-variant bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-on-surface-variant/60">
            {label}
          </p>
          <div className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-on-surface flex items-end gap-1.5">
            {value}
            {trend === 'up'   && <span className="text-success text-sm mb-0.5">↑</span>}
            {trend === 'down' && <span className="text-danger text-sm mb-0.5">↓</span>}
            {trend === 'flat' && <span className="text-on-surface-variant text-sm mb-0.5">─</span>}
          </div>
          {meta && (
            <div className="mt-1.5 text-[11px] text-on-surface-variant">{meta}</div>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

// ── EmptyPanel ────────────────────────────────────────────────────────────────

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
    <div className={cn(
      'rounded-lg border border-dashed border-outline-variant bg-surface-container-low/50 px-5 py-8 text-center',
      className
    )}>
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-on-surface-variant">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── ActionPill ────────────────────────────────────────────────────────────────

export function ActionPill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-medium text-on-surface-variant',
      className
    )}>
      {children}
    </span>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-t border-outline-variant', className)} />
}

// ── SystemActionBubble ────────────────────────────────────────────────────────
// For AI chat actions (task created, memory saved, etc.)

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
    <div className={cn('flex justify-center my-2', className)}>
      <div className="chat-bubble-system inline-flex items-center gap-2.5 max-w-[65%]">
        <span className="shrink-0 text-ai-purple">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-on-surface">{title}</p>
          {detail && <p className="text-[11px] text-on-surface-variant mt-0.5">{detail}</p>}
        </div>
        {onUndo && (
          <button
            onClick={onUndo}
            className="shrink-0 text-[11px] font-medium text-accent hover:text-accent-hover transition-colors whitespace-nowrap"
          >
            {undoLabel}
          </button>
        )}
      </div>
    </div>
  )
}
