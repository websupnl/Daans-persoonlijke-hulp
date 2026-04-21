import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'bg-[#f8fbfb] border-outline-variant placeholder:text-muted-foreground focus-visible:border-accent focus-visible:ring-accent/20 aria-invalid:ring-destructive/20',
        'dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-24 w-full rounded-md border px-3.5 py-3 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none',
        'focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
