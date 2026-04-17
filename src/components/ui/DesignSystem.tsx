/**
 * Nieuw Design Systeem - Geïnspireerd op Talab Edu voorbeeld
 * Minder bulky cards, betere mobiele ervaring, consistente styling
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
        'bg-white border border-gray-200 rounded-lg',
        paddingMap[padding],
        hover && 'hover:border-gray-300 hover:shadow-sm transition-all',
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
        'flex items-center gap-3 py-3 px-4 border-b border-gray-100 last:border-b-0',
        hover && 'hover:bg-gray-50 cursor-pointer transition-colors',
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
    <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
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
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-50'
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
    <div className={cn('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {headers.map((header) => (
                <th
                  key={header.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider"
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {headers.map((header) => (
                  <td key={header.key} className="px-4 py-3 text-sm text-gray-700">
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
    <div className={cn('w-full bg-gray-200 rounded-full', sizeClasses[size])}>
      <div
        className={cn('rounded-full transition-all', colorClasses[color])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
