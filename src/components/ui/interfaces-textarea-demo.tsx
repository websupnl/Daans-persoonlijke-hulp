'use client'

import { Textarea } from '@/components/ui/interfaces-textarea'

export default function TextareaDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-8">
      <div className="w-full max-w-md space-y-4">
        <Textarea placeholder="Type your message here..." rows={4} />
      </div>
    </div>
  )
}
