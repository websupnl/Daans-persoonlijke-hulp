'use client'

import { MorphPanel } from '@/components/ui/ai-prompt-box'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Brain, Sparkles, MessageSquare, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIAssistantCommandCenterProps {
  className?: string
}

export function AIAssistantCommandCenter({ className }: AIAssistantCommandCenterProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Niet tonen op de chat pagina zelf
  if (pathname === '/chat') return null

  const handleSend = async (message: string) => {
    if (!message.trim()) return
    
    setLoading(true)
    // We sturen de gebruiker naar de chat met het bericht
    // In een echte app zouden we dit misschien via een context provider doen
    // of direct de API callen en een kleine preview tonen.
    // Gezien de opdracht "consistent entry point", is redirecten naar chat logisch.
    router.push(`/chat?q=${encodeURIComponent(message)}`)
    setLoading(false)
    setInput('')
  }

  const getPlaceholder = () => {
    if (pathname === '/finance') return 'Vraag iets over je financiën...'
    if (pathname === '/todos') return 'Vraag iets over je taken...'
    if (pathname === '/notes') return 'Doorzoek je notities met AI...'
    return 'Stel een vraag aan je AI assistent...'
  }

  return (
    <div className={cn(
      "fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40 animate-slide-up",
      className
    )}>
      <div className="relative group">
        <div className="absolute -top-12 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-surface-raised border border-border px-3 py-1 rounded-full shadow-sm flex items-center gap-2">
            <Sparkles size={12} className="text-ai" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">AI Command Center</span>
          </div>
        </div>
        
        <MorphPanel
          value={input}
          onValueChange={setInput}
          onSend={handleSend}
          placeholder={getPlaceholder()}
          isLoading={loading}
          className="shadow-lg backdrop-blur-xl bg-surface/90"
        />
      </div>
    </div>
  )
}
