/**
 * AI Context Input Component
 * Staat gebruikers toe om context te geven aan AI voor elk item
 */

'use client'

import { useState } from 'react'
import { Send, X, MessageSquare } from 'lucide-react'

interface ContextInputProps {
  itemId: number
  itemType: 'transaction' | 'worklog' | 'todo' | 'note' | 'project'
  onSendContext: (itemId: number, context: string) => Promise<void>
  placeholder?: string
  className?: string
}

export default function ContextInput({ 
  itemId, 
  itemType, 
  onSendContext, 
  placeholder = "Voeg context toe voor AI analyse...",
  className = "" 
}: ContextInputProps) {
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!context.trim()) return
    
    setLoading(true)
    try {
      await onSendContext(itemId, context)
      setContext('')
    } finally {
      setLoading(false)
    }
  }

  const getItemTypeLabel = () => {
    switch (itemType) {
      case 'transaction': return 'Transactie'
      case 'worklog': return 'Werklog'
      case 'todo': return 'Taak'
      case 'note': return 'Notitie'
      case 'project': return 'Project'
      default: return 'Item'
    }
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare size={16} className="text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          AI Context voor {getItemTypeLabel()}
        </span>
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        
        <button
          onClick={handleSend}
          disabled={loading || !context.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Bezig...</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>Verstuur</span>
            </>
          )}
        </button>
      </div>
      
      <div className="text-xs text-blue-600 mt-2">
        💡 Tip: Geef specifieke context of vragen die de AI moet meenemen bij de analyse van dit {itemType.toLowerCase()}
      </div>
    </div>
  )
}
