import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  iconLeft,
  iconRight,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium rounded-lg transition-all inline-flex items-center justify-center gap-2'
  
  const variants = {
    primary: 'bg-[#202625] text-white hover:bg-[#2a3230] disabled:bg-surface-container-high disabled:text-on-surface-variant',
    secondary: 'bg-surface-container-low text-on-surface hover:bg-surface-container disabled:bg-surface-container-low disabled:text-on-surface-variant',
    outline: 'border border-black/[0.08] text-on-surface hover:bg-surface-container-low disabled:bg-surface-container-low disabled:text-on-surface-variant',
    ghost: 'text-on-surface hover:bg-surface-container-low disabled:text-on-surface-variant',
    destructive: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      {...props}
    >
      {iconLeft && <span>{iconLeft}</span>}
      {children}
      {iconRight && <span>{iconRight}</span>}
    </button>
  )
}

interface LinkButtonProps {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
  size = 'md',
  className,
  iconLeft,
  iconRight,
}: LinkButtonProps) {
  const baseClasses = 'font-medium rounded-lg transition-all inline-flex items-center justify-center gap-2'
  
  const variants = {
    primary: 'bg-[#202625] text-white hover:bg-[#2a3230]',
    secondary: 'bg-surface-container-low text-on-surface hover:bg-surface-container',
    outline: 'border border-black/[0.08] text-on-surface hover:bg-surface-container-low',
    ghost: 'text-on-surface hover:bg-surface-container-low'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <Link
      href={href}
      className={cn(baseClasses, variants[variant], sizes[size], className)}
    >
      {iconLeft && <span>{iconLeft}</span>}
      {children}
      {iconRight && <span>{iconRight}</span>}
    </Link>
  )
}

// Aliases for compatibility
export { Button as ModernButton }
