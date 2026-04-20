/**
 * Nieuw Design Systeem - Geïnspireerd op Talab Edu voorbeeld
 * Minder bulky cards, betere mobiele ervaring, consistente styling
 *
 * @deprecated Gebruik canonieke primitives uit:
 * - src/components/ui/button.tsx
 * - src/components/ui/card.tsx
 * - src/components/ui/Panel.tsx
 * - src/components/ui/PageShell.tsx
 */

import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

// Kleurenpalet gebaseerd op voorbeeld
export const colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
  },
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    500: '#10b981',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    500: '#f59e0b',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    500: '#ef4444',
  }
}

// Spacing systeem
export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '0.75rem',    // 12px
  lg: '1rem',       // 16px
  xl: '1.5rem',     // 24px
  xxl: '2rem',      // 32px
}

// Lightweight Card Component - minder bulky
export function LightCard({ 
  children, 
  className, 
  hover = false,
  padding = 'md'
}: { 
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: 'sm' | 'md' | 'lg'
}) {
  const paddingMap = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  }

  return (
    <div 
      className={cn(
        'rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]',
        paddingMap[padding],
        hover && 'transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_26px_64px_-40px_rgba(31,37,35,0.32)]',
        className
      )}
    >
      {children}
    </div>
  )
}

// Compact List Item - vervangt bulky cards
export function CompactListItem({
  children,
  className,
  hover = false,
  onClick
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border-b border-outline-variant py-3 px-4 last:border-b-0',
        hover && 'cursor-pointer transition-colors hover:bg-surface-container-low',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// Modern Stats Card - minder bulky
export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}) {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-600'
  }

  return (
    <div className={cn('rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">{title}</p>
          <p className="mt-2 text-2xl font-headline font-extrabold tracking-tight text-on-surface">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className={cn('text-sm font-medium mt-3', trendColors[trend])}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </div>
      )}
    </div>
  )
}

// Modern Button - consistent styling
export function ModernButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  disabled = false
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  const baseClasses = 'font-medium rounded-lg transition-all inline-flex items-center gap-2'
  
  const variants = {
    primary: 'bg-accent text-white hover:bg-[#2a3230] disabled:bg-surface-container-high disabled:text-on-surface-variant',
    secondary: 'bg-surface-container-low text-on-surface hover:bg-surface-container disabled:bg-surface-container-low disabled:text-on-surface-variant',
    outline: 'border border-black/[0.08] text-on-surface hover:bg-surface-container-low disabled:bg-surface-container-low disabled:text-on-surface-variant'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  }

  return (
    <button
      className={cn(baseClasses, variants[variant], sizes[size], className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Table Component voor data-overzichten
export function ModernTable({
  headers,
  rows,
  className
}: {
  headers: Array<{ key: string; label: string }>
  rows: Array<Record<string, any>>
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-outline-variant bg-surface-container-low">
            <tr>
              {headers.map((header) => (
                <th
                  key={header.key}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75"
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-surface-container-low/60">
                {headers.map((header) => (
                  <td key={header.key} className="px-4 py-3 text-sm text-on-surface">
                    {row[header.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Progress Indicator
export function ProgressIndicator({
  value,
  max = 100,
  size = 'sm',
  color = 'blue'
}: {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  color?: 'blue' | 'green' | 'red'
}) {
  const percentage = Math.min((value / max) * 100, 100)
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600'
  }

  return (
    <div className={cn('w-full rounded-full bg-surface-container', sizeClasses[size])}>
      <div
        className={cn('rounded-full transition-all', colorClasses[color])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
