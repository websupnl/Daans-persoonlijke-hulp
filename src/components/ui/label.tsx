import { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-[13px] font-medium text-on-surface mb-1', className)}
      {...props}
    >
      {children}
    </label>
  )
}
