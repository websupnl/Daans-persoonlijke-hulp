import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ── Variants ──────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'default' | 'destructive' | 'outline'
type Size    = 'sm' | 'md' | 'lg' | 'default' | 'icon'

const variantClasses: Record<string, string> = {
  primary:     'bg-accent text-white hover:bg-accent-hover focus-visible:shadow-focus',
  default:     'bg-accent text-white hover:bg-accent-hover focus-visible:shadow-focus',
  secondary:   'bg-white border border-outline-variant text-on-surface hover:bg-surface-container-low focus-visible:shadow-focus',
  outline:     'bg-transparent border border-outline-variant text-on-surface hover:bg-surface-container focus-visible:shadow-focus',
  ghost:       'bg-transparent text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:shadow-focus',
  danger:      'bg-error text-white hover:bg-red-600 focus-visible:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
  destructive: 'bg-error text-white hover:bg-red-600 focus-visible:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
  ai:          'bg-ai-purple-bg border border-ai-purple-border text-ai-purple hover:bg-purple-100 focus-visible:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]',
}

const sizeClasses: Record<string, string> = {
  sm:      'h-8 px-3 text-[12px] rounded-lg gap-1.5',
  md:      'h-9 px-4 text-[13px] rounded-lg gap-2',
  lg:      'h-10 px-5 text-[14px] rounded-xl gap-2',
  default: 'h-9 px-4 text-[13px] rounded-lg gap-2',
  icon:    'h-9 w-9 rounded-lg',
}

// ── Button ────────────────────────────────────────────────────────────────────

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
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none',
          'focus-visible:outline-none',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantClasses[variant] ?? variantClasses.default,
          sizeClasses[size] ?? sizeClasses.default,
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ── LinkButton ────────────────────────────────────────────────────────────────

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
        'inline-flex items-center justify-center font-medium transition-all duration-150 select-none',
        'focus-visible:outline-none',
        variantClasses[variant] ?? variantClasses.default,
        sizeClasses[size] ?? sizeClasses.default,
        className,
      )}
    >
      {children}
      {iconRight && <span className="ml-1">{iconRight}</span>}
    </Link>
  )
}

// ── IconButton ────────────────────────────────────────────────────────────────

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
        'inline-flex items-center justify-center h-9 w-9 rounded-lg transition-all duration-150',
        'focus-visible:outline-none focus-visible:shadow-focus',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant] ?? variantClasses.ghost,
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}

// ── Chip ─────────────────────────────────────────────────────────────────────

type ChipColor = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'violet'

const chipColors: Record<ChipColor, string> = {
  default: 'bg-surface-container text-on-surface-variant',
  blue:    'bg-blue-50 text-accent border border-accent/10',
  green:   'bg-success-bg text-success border border-success/10',
  amber:   'bg-warning-bg text-warning border border-warning-border',
  red:     'bg-red-50 text-error border border-red-200',
  violet:  'bg-ai-purple-bg text-ai-purple border border-ai-purple-border',
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
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
      chipColors[color],
      className,
    )}>
      {children}
    </span>
  )
}

// ── AIChip ────────────────────────────────────────────────────────────────────

export function AIChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
      'bg-ai-purple-bg text-ai-purple border border-ai-purple-border',
      className,
    )}>
      <span className="text-[10px] leading-none">✦</span>
      {children}
    </span>
  )
}
