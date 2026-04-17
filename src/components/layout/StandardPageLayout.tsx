'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LightCard } from '@/components/ui/DesignSystem'

interface StandardPageLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Standaard layout voor alle pagina's
 * - Consistente header structuur
 * - Compact design zonder grote kaarten
 * - Flexibele action placement
 */
export default function StandardPageLayout({
  title,
  subtitle,
  children,
  actions,
  className
}: StandardPageLayoutProps) {
  return (
    <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6', className)}>
      {/* Header - altijd consistent */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {/* Content - geen grote kaarten, direct content */}
      <div className="space-y-6">
        {children}
      </div>
    </div>
  )
}

/**
 * Compacte section wrapper voor pagina content
 */
export function Section({ 
  title, 
  children, 
  className 
}: { 
  title?: string
  children: ReactNode
  className?: string 
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      )}
      {children}
    </div>
  )
}

/**
 * Compacte stats grid voor pagina headers
 */
export function StatsGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {children}
    </div>
  )
}

/**
 * Compacte main content area met sidebar
 */
export function MainWithSidebar({
  sidebar,
  children
}: {
  sidebar: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        {sidebar}
      </div>
      <div className="lg:col-span-3">
        {children}
      </div>
    </div>
  )
}
