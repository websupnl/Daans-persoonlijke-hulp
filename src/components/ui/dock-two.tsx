'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Variants } from 'framer-motion'

interface DockProps {
  className?: string
  items: {
    icon: LucideIcon
    label: string
    onClick?: () => void
  }[]
}

interface DockIconButtonProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  className?: string
}

const floatingAnimation: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-2, 2, -2],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
}

const DockIconButton = React.forwardRef<HTMLButtonElement, DockIconButtonProps>(
  ({ icon: Icon, label, onClick, className }, ref) => {
    return (
      <motion.button
        ref={ref}
        type="button"
        aria-label={label}
        whileHover={{ scale: 1.08, y: -3 }}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        className={cn(
          'focus-ring group relative flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-text-primary shadow-xs transition-colors',
          'focus-visible:outline-none hover:bg-surface-hover',
          className
        )}
      >
        <Icon className="h-5 w-5" />
        <span
          className={cn(
            'pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-xs font-medium text-text-inverse',
            'opacity-0 transition-opacity group-hover:opacity-100'
          )}
        >
          {label}
        </span>
      </motion.button>
    )
  }
)
DockIconButton.displayName = 'DockIconButton'

const Dock = React.forwardRef<HTMLDivElement, DockProps>(({ items, className }, ref) => {
  return (
    <div ref={ref} className={cn('w-full overflow-x-auto pb-2', className)}>
      <div className="flex justify-center">
        <motion.div
          initial="initial"
          animate="animate"
          variants={floatingAnimation}
          className={cn(
            'inline-flex min-w-max items-center gap-2 rounded-[22px] border border-border bg-surface p-2 shadow-lg',
            'backdrop-blur-lg transition-shadow duration-300 hover:shadow-xl'
          )}
        >
          {items.map((item) => (
            <DockIconButton key={item.label} {...item} />
          ))}
        </motion.div>
      </div>
    </div>
  )
})
Dock.displayName = 'Dock'

export { Dock }
