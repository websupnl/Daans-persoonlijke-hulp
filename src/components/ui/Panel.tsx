import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PanelTone = 'default' | 'muted' | 'accent' | 'inverse' | 'warning'
type PanelPadding = 'sm' | 'md' | 'lg'

const toneClasses: Record<PanelTone, string> = {
  default: 'bg-surface-container-lowest border border-black/5 shadow-[0_24px_60px_-36px_rgba(31,37,35,0.28)]',
  muted: 'bg-surface-container-low border border-black/5',
  accent: 'bg-brand-subtle border border-black/5 shadow-[0_24px_60px_-36px_rgba(90,103,123,0.18)]',
  inverse: 'bg-[#202625] text-white border border-black/10 shadow-[0_24px_60px_-30px_rgba(18,22,21,0.45)]',
  warning: 'bg-[#fff7eb] border border-[#eed6b6] shadow-[0_18px_40px_-30px_rgba(164,104,27,0.28)]',
}

const paddingClasses: Record<PanelPadding, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
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
        'rounded-[28px]',
        toneClasses[tone],
        paddingClasses[padding],
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-38px_rgba(31,37,35,0.32)]',
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/75">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-1 text-lg font-headline font-extrabold tracking-tight text-on-surface">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

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
    <div className={cn('rounded-[24px] border border-black/5 bg-white/70 p-4 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
            {label}
          </p>
          <div className="mt-2 text-2xl font-headline font-extrabold tracking-tight text-on-surface">
            {value}
          </div>
          {meta && (
            <div className="mt-1.5 text-sm text-on-surface-variant">
              {meta}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface">
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
    <div className={cn('rounded-[24px] border border-dashed border-outline-variant/50 bg-white/50 px-5 py-8 text-center', className)}>
      <p className="text-base font-headline font-bold text-on-surface">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
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
    <span className={cn('inline-flex items-center rounded-full border border-black/5 bg-white/80 px-3 py-1.5 text-xs font-medium text-on-surface-variant shadow-[0_12px_30px_-24px_rgba(31,37,35,0.25)]', className)}>
      {children}
    </span>
  )
}
