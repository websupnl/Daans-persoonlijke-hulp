import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const variants: Record<BadgeVariant, string> = {
  default:     'bg-accent text-white',
  secondary:   'bg-surface-container text-on-surface-variant',
  destructive: 'bg-danger-bg text-danger',
  outline:     'border border-outline-variant text-on-surface-variant',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
