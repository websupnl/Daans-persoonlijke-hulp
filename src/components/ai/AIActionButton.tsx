/**
 * AI Action Button Component
 * Universele AI knop voor alle items om acties te triggeren
 */

'use client'

import { useState } from 'react'
import { Brain, Sparkles, TrendingUp, MessageSquare, Zap } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface AIActionButtonProps {
  itemId: number
  itemType: 'transaction' | 'worklog' | 'todo' | 'note' | 'project' | 'pattern' | 'question'
  onAIAction: (itemId: number, action: string, context?: string) => Promise<void>
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary'
}

export default function AIActionButton({ 
  itemId, 
  itemType, 
  onAIAction,
  className = "",
  size = 'md',
  variant = 'primary'
}: AIActionButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showActions, setShowActions] = useState(false)

  const getAIActions = () => {
    const actions = [
      { id: 'analyze', label: 'Analyseer dit item', icon: Brain, description: 'Diepgaande AI analyse' },
      { id: 'suggest', label: 'Geef suggesties', icon: Sparkles, description: 'AI suggesties voor verbetering' },
      { id: 'trend', label: 'Bekijk trends', icon: TrendingUp, description: 'Toon gerelateerde trends' },
    ]

    // Item-specifieke acties
    if (itemType === 'transaction') {
      actions.push(
        { id: 'categorize', label: 'Categoriseer', icon: Zap, description: 'Automatische categorisatie' },
        { id: 'similar', label: 'Vergelijkbare transacties', icon: TrendingUp, description: 'Toon vergelijkbare uitgaven' }
      )
    }

    if (itemType === 'worklog') {
      actions.push(
        { id: 'optimize', label: 'Optimaliseer planning', icon: TrendingUp, description: 'AI planning suggesties' },
        { id: 'productivity', label: 'Productiviteitsanalyse', icon: Brain, description: 'Analyseer werkpatronen' }
      )
    }

    if (itemType === 'todo') {
      actions.push(
        { id: 'prioritize', label: 'Prioriteer taken', icon: Zap, description: 'AI prioriteitstelling' },
        { id: 'breakdown', label: 'Taak opdelen', icon: Brain, description: 'Splits taak in subtaken' }
      )
    }

    if (itemType === 'pattern' || itemType === 'question') {
      actions.push(
        { id: 'explore', label: 'Verdiep analyse', icon: Brain, description: 'Diepgaande patroonanalyse' },
        { id: 'relate', label: 'Verbind patronen', icon: TrendingUp, description: 'Zoek verbanden met andere patronen' }
      )
    }

    return actions
  }

  const handleAction = async (actionId: string) => {
    setLoading(true)
    try {
      await onAIAction(itemId, actionId)
      setShowActions(false)
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
      case 'pattern': return 'Patroon'
      case 'question': return 'Vraag'
      default: return 'Item'
    }
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  }

  const variantClasses = {
    primary: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowActions(!showActions)}
        disabled={loading}
        className={`
          ${sizeClasses[size]} 
          ${variantClasses[variant]}
          rounded-lg font-medium transition-all duration-200 
          flex items-center gap-2 shadow-sm hover:shadow-md
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {loading ? (
          <>
            <Spinner className="h-4 w-4" />
            <span>Bezig...</span>
          </>
        ) : (
          <>
            <Brain size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            <span>AI Acties</span>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {showActions && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowActions(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                AI Acties voor {getItemTypeLabel()}
              </div>
              
              {getAIActions().map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                >
                  <action.icon size={16} className="text-gray-400 group-hover:text-gray-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                      {action.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {action.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
