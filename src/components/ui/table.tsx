import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="w-full overflow-auto">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  )
}
export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="border-b border-outline-variant">{children}</thead>
}
export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-outline-variant">{children}</tbody>
}
export function TableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('hover:bg-surface-container-low transition-colors', className)}>{children}</tr>
}
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant/60', className)}>
      {children}
    </th>
  )
}
export function TableCell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-[13px] text-on-surface', className)}>{children}</td>
}
