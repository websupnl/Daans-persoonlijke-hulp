import { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children?: ReactNode
}

export function Button({ variant = 'default', size = 'default', className, children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50'

  const variants: Record<string, string> = {
    default: 'bg-[#202625] text-white hover:bg-[#2a3230]',
    outline: 'border border-black/[0.12] bg-transparent hover:bg-surface-container-low',
    secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'hover:bg-surface-container-low',
  }

  const sizes: Record<string, string> = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-10 px-8 text-sm',
    icon: 'h-9 w-9',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
}

interface LinkButtonProps {
  href: string
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  children?: ReactNode
  iconRight?: ReactNode
}

export function LinkButton({ href, variant = 'default', size = 'default', className, children, iconRight }: LinkButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2'

  const variants: Record<string, string> = {
    default: 'bg-[#202625] text-white hover:bg-[#2a3230]',
    outline: 'border border-black/[0.12] bg-transparent hover:bg-surface-container-low',
    secondary: 'bg-surface-container text-on-surface hover:bg-surface-container-high',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
  }

  const sizes: Record<string, string> = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-10 px-8 text-sm',
    icon: 'h-9 w-9',
  }

  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
      {iconRight}
    </Link>
  )
}
