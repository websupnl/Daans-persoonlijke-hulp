import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Laden"
      className={cn(
        'inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className
      )}
    />
  )
}
