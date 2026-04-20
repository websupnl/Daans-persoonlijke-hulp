'use client'

/**
 * AIContextPanel — de slimme context flow voor elk item in de app.
 *
 * Flow:
 * 1. User tikt Sparkles-knop op een item
 * 2. Panel opent (bottom sheet op mobile, floating panel op desktop)
 * 3. AI analyseert item + bestaande data → geeft suggesties
 * 4. User kiest suggesties + bevestigt
 * 5. Acties worden uitgevoerd via /api/ai/context-flow
 *
 * Denk na vóór opslaan: een todo kan ook een project, werklog en notitie raken.
 */

import { useState, useEffect } from 'react'
import { X, Loader2, Check, FolderOpen, Clock, FileText, Lightbulb, Sparkles, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/interfaces-textarea'

interface Suggestion {
  id: string
  type: 'link_project' | 'create_worklog' | 'create_note' | 'link_contact' | 'create_todo' | 'update_memory' | 'create_idea'
  label: string
  description: string
  payload: Record<string, unknown>
  auto?: boolean       // AI recommends this
}

interface AnalysisResult {
  summary: string
  suggestions: Suggestion[]
  context_notes: string[]
}

const SUGGESTION_ICONS: Record<string, React.ElementType> = {
  link_project:   FolderOpen,
  create_worklog: Clock,
  create_note:    FileText,
  create_idea:    Lightbulb,
  create_todo:    Check,
  update_memory:  Sparkles,
  link_contact:   ChevronRight,
}

const SUGGESTION_COLORS: Record<string, string> = {
  link_project:   'bg-blue-50 text-blue-600 border-blue-100',
  create_worklog: 'bg-teal-50 text-teal-600 border-teal-100',
  create_note:    'bg-violet-50 text-violet-600 border-violet-100',
  create_idea:    'bg-yellow-50 text-yellow-600 border-yellow-100',
  create_todo:    'bg-orange-50 text-orange-600 border-orange-100',
  update_memory:  'bg-pink-50 text-pink-600 border-pink-100',
  link_contact:   'bg-green-50 text-green-600 border-green-100',
}

interface AIContextPanelProps {
  type: string
  title: string
  content?: string
  id?: number
  onClose: () => void
}

export default function AIContextPanel({ type, title, content, id, onClose }: AIContextPanelProps) {
  const [step, setStep] = useState<'loading' | 'suggestions' | 'executing' | 'done' | 'error'>('loading')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Load analysis on mount
  useEffect(() => {
    let cancelled = false

    fetch('/api/ai/context-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, content, id }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.error) { setError(data.error); setStep('error'); return }
        setAnalysis(data)
        // Auto-select recommended suggestions
        const autoSelected = new Set(
          (data.suggestions as Suggestion[])
            .filter(s => s.auto)
            .map(s => s.id)
        )
        setSelected(autoSelected)
        setStep('suggestions')
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message ?? 'Analyse mislukt')
        setStep('error')
      })

    return () => { cancelled = true }
  }, [type, title, content, id])

  function toggleSuggestion(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleExecute() {
    if (!analysis) return
    setStep('executing')

    const chosenSuggestions = analysis.suggestions.filter(s => selected.has(s.id))

    const res = await fetch('/api/ai/context-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, title, content, id,
        execute: true,
        selectedSuggestions: chosenSuggestions,
        userNote: note.trim() || undefined,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Uitvoering mislukt')
      setStep('error')
    } else {
      setStep('done')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] glass-dark"
        onClick={onClose}
      />

      {/* Panel — bottom sheet on mobile, centered on desktop */}
      <div className="fixed z-[90] inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[440px] md:max-h-[80dvh]">
        <div className="bg-surface-container-lowest rounded-t-3xl md:rounded-3xl shadow-ambient max-h-[82dvh] flex flex-col animate-slide-up overflow-hidden">
          {/* Handle (mobile only) */}
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-outline-variant opacity-30" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-subtle flex items-center justify-center">
                <Sparkles size={14} className="icon-gradient" />
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">AI Context</p>
                <p className="text-sm font-headline font-bold text-on-surface leading-tight truncate max-w-[240px]">{title}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">

            {/* Loading */}
            {step === 'loading' && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 size={24} className="animate-spin text-pink-400" />
                <p className="text-sm text-on-surface-variant">Analyseren en verbanden zoeken...</p>
              </div>
            )}

            {/* Error */}
            {step === 'error' && (
              <div className="bg-error-container/20 rounded-xl p-4 text-sm text-red-700">
                {error ?? 'Er ging iets mis. Probeer opnieuw.'}
              </div>
            )}

            {/* Suggestions */}
            {(step === 'suggestions' || step === 'executing') && analysis && (
              <>
                {/* AI summary */}
                <div className="bg-brand-subtle rounded-xl p-3">
                  <p className="text-xs text-on-surface-variant leading-relaxed">{analysis.summary}</p>
                </div>

                {/* Context notes */}
                {analysis.context_notes.length > 0 && (
                  <ul className="space-y-1">
                    {analysis.context_notes.map((note, i) => (
                      <li key={i} className="text-xs text-on-surface-variant flex items-start gap-2">
                        <span className="mt-0.5 text-pink-400">•</span>
                        {note}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Suggestion chips */}
                {analysis.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Suggesties</p>
                    {analysis.suggestions.map(s => {
                      const Icon = SUGGESTION_ICONS[s.type] ?? Sparkles
                      const colorClass = SUGGESTION_COLORS[s.type] ?? 'bg-surface-container text-on-surface-variant border-outline-variant'
                      const isSelected = selected.has(s.id)
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleSuggestion(s.id)}
                          disabled={step === 'executing'}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150',
                            isSelected
                              ? `${colorClass} opacity-100 shadow-ambient-xs`
                              : 'bg-surface-container border-transparent opacity-60 hover:opacity-80',
                          )}
                        >
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                            isSelected ? colorClass : 'bg-surface-container-high text-on-surface-variant'
                          )}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-on-surface">{s.label}</p>
                            <p className="text-[10px] text-on-surface-variant">{s.description}</p>
                          </div>
                          <div className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                            isSelected ? 'bg-brand-gradient border-transparent' : 'border-outline-variant bg-transparent'
                          )}>
                            {isSelected && <Check size={9} className="text-white" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Optional note */}
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Extra context (optioneel)</p>
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Voeg toe wat de AI moet weten..."
                    rows={2}
                    className="resize-none rounded-xl border-0 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:ring-1 focus-visible:ring-pink-300"
                  />
                </div>
              </>
            )}

            {/* Done */}
            {step === 'done' && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check size={22} className="text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-on-surface">Klaar!</p>
                <p className="text-xs text-on-surface-variant text-center">Alle geselecteerde acties zijn uitgevoerd.</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {(step === 'suggestions' || step === 'executing') && (
            <div className="px-5 pb-6 pt-2 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-surface-container text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleExecute}
                disabled={step === 'executing' || selected.size === 0}
                className="flex-1 py-2.5 rounded-xl btn-gradient text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {step === 'executing' ? (
                  <><Loader2 size={15} className="animate-spin" /> Bezig...</>
                ) : (
                  `${selected.size > 0 ? `${selected.size} actie${selected.size > 1 ? 's' : ''} uitvoeren` : 'Niets geselecteerd'}`
                )}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="px-5 pb-6 pt-2">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl btn-gradient text-sm font-semibold"
              >
                Sluiten
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
