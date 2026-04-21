import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-12 w-full rounded-md border border-outline-variant bg-[#f8fbfb] px-3.5 py-3 text-[14px] text-on-surface',
          'placeholder:text-on-surface-variant/50',
          'hover:bg-white hover:border-accent/70 focus:outline-none focus:border-accent focus:shadow-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-150',
          className
        )}
        {...props}
      />
    )
  }
)
