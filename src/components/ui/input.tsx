import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-outline-variant bg-white px-3 py-2 text-[14px] text-on-surface',
          'placeholder:text-on-surface-variant/50',
          'focus:outline-none focus:border-accent focus:shadow-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-150',
          className
        )}
        {...props}
      />
    )
  }
)
