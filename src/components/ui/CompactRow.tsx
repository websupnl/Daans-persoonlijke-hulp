/**
 * CompactRow — universal list item for all modules.
 * Features: left icon/color, title, subtitle, right meta, AI context button slot.
 * No border — hover via tonal background shift.
 */

'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import AIContextButton from '@/components/ai/AIContextButton'

interface CompactRowProps {
  /** Left decorative element (icon wrapper, checkbox, dot, etc.) */
  left?: ReactNode
  title: string
  subtitle?: string
  /** Right-side meta (date, amount, badge, etc.) */
  meta?: ReactNode
  /** Extra right element (status dot, tag, etc.) */
  badge?: ReactNode
  onClick?: () => void
  className?: string
  /** Whether to show the AI context spark button */
  aiContext?: {
    type: string
    title: string
    content?: string
    id?: number
  }
  /** Muted / completed appearance */
  muted?: boolean
}

export default function CompactRow({
  left,
  title,
  subtitle,
  meta,
  badge,
  onClick,
  className,
  aiContext,
  muted,
}: CompactRowProps) {
  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150',
        onClick ? 'cursor-pointer hover:bg-surface-container' : '',
        muted && 'opacity-50',
        className
      )}
      onClick={onClick}
    >
      {/* Left slot */}
      {left && <div className="shrink-0">{left}</div>}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-sm font-medium text-on-surface leading-snug truncate',
          muted && 'line-through'
        )}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Right meta */}
      {meta && (
        <div className="shrink-0 text-right">
          {meta}
        </div>
      )}

      {badge && <div className="shrink-0">{badge}</div>}

      {/* AI context button — appears on group hover */}
      {aiContext && (
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <AIContextButton
            type={aiContext.type}
            title={aiContext.title}
            content={aiContext.content}
            id={aiContext.id}
          />
        </div>
      )}
    </div>
  )
}

/** Separator between rows (whitespace only — no line) */
export function RowSeparator() {
  return <div className="h-px bg-surface-container-high mx-3 opacity-60" />
}
