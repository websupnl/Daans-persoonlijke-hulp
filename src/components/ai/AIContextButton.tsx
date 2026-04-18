'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import AIContextPanel from './AIContextPanel'

interface AIContextButtonProps {
  type: string
  title: string
  content?: string
  id?: number
  className?: string
}

export default function AIContextButton({ type, title, content, id, className }: AIContextButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        title="AI context toevoegen"
        className={cn(
          'flex items-center justify-center w-6 h-6 rounded-lg transition-all duration-150',
          'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
          className
        )}
      >
        <Sparkles size={13} strokeWidth={1.8} />
      </button>

      {open && (
        <AIContextPanel
          type={type}
          title={title}
          content={content}
          id={id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
