import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'default' | 'destructive' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'default' | 'icon'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-text-inverse hover:bg-accent-hover',
  default: 'bg-accent text-text-inverse hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-text-primary hover:bg-surface-hover',
  outline: 'border border-border-strong bg-transparent text-text-primary hover:bg-surface-hover',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger: 'bg-error text-text-inverse hover:bg-red-600',
  destructive: 'bg-error text-text-inverse hover:bg-red-600',
  ai: 'button-ai-shimmer bg-gradient text-text-inverse hover:opacity-95',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-7 rounded-md px-3 text-sm gap-1.5',
  md: 'h-9 rounded-md px-4 text-sm gap-2',
  lg: 'h-11 rounded-lg px-5 text-base gap-2',
  default: 'h-9 rounded-md px-4 text-sm gap-2',
  icon: 'h-9 w-9 rounded-md',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children?: ReactNode
  className?: string
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'default', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'focus-ring inline-flex items-center justify-center font-semibold transition-all duration-base ease-calm select-none',
          'focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export function LinkButton({
  href,
  variant = 'default',
  size = 'default',
  className,
  children,
  iconRight,
}: {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
  iconRight?: ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'focus-ring inline-flex items-center justify-center font-semibold transition-all duration-base ease-calm select-none',
        'focus-visible:outline-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
      {iconRight && <span className="ml-1">{iconRight}</span>}
    </Link>
  )
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  className,
  ...props
}: {
  icon: ReactNode
  label: string
  variant?: Variant
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      className={cn(
        'focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md transition-all duration-base ease-calm',
        'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
}

type ChipColor = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'violet'

const chipColors: Record<ChipColor, string> = {
  default: 'bg-surface-inset text-text-secondary',
  blue: 'border border-accent-muted bg-accent-subtle text-accent',
  green: 'border border-success/10 bg-success-subtle text-success',
  amber: 'border border-warning-border bg-warning-subtle text-warning',
  red: 'border border-red-200 bg-error-subtle text-error',
  violet: 'border border-ai-muted bg-ai-subtle text-ai',
}

export function Chip({
  children,
  color = 'default',
  className,
}: {
  children: ReactNode
  color?: ChipColor
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium', chipColors[color], className)}>
      {children}
    </span>
  )
}

export function AIChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-pill border border-ai-muted bg-ai-subtle px-3 py-1 text-xs font-medium text-ai', className)}>
      <span className="text-[10px] leading-none">✦</span>
      {children}
    </span>
  )
}
