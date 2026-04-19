import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type AlertVariant = 'default' | 'destructive'

export function Alert({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode
  variant?: AlertVariant
  className?: string
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 text-[13px]',
      variant === 'destructive'
        ? 'border-danger/20 bg-danger-bg text-danger'
        : 'border-outline-variant bg-surface-container-low text-on-surface',
      className
    )}>
      {children}
    </div>
  )
}

export function AlertDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-1 text-[12px] leading-5', className)}>{children}</p>
}
