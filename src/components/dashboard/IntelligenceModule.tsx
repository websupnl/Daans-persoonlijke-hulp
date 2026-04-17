'use client'

import { useEffect, useState } from 'react'
import { Brain, Lightbulb, MessageSquare, AlertCircle, ChevronRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface Theory {
  id: number
  category: string
  theory: string
  confidence: number
  status: string
  impact_score: number
  source_modules: string | string[]
  updated_at: string
}

interface Question {
  id: number
  source_module: string
  question: string
  rationale: string
  status: string
  priority: number
  created_at: string
}

export default function IntelligenceModule() {
  const [data, setData] = useState<{ theories: Theory[], questions: Question[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ai/sync', { method: 'POST' })
      const d = await res.json()
      if (d.success) {
        const refreshRes = await fetch('/api/intelligence')
        const refreshData = await refreshRes.json()
        setData(refreshData)
      }
    } catch (err) {
      console.error('[IntelligenceModule] Sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetch('/api/intelligence')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(err => console.error('[IntelligenceModule] fetch error:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm animate-pulse">
        <div className="h-6 w-32 bg-gray-100 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-20 bg-gray-50 rounded-2xl" />
          <div className="h-20 bg-gray-50 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Brain size={18} className="text-violet-500" />
          Intelligence &amp; Patronen
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSync}
            disabled={syncing}
            className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex items-center gap-1",
              syncing 
                ? "bg-violet-100 text-violet-400 animate-pulse cursor-not-allowed" 
                : "bg-violet-50 text-violet-600 hover:bg-violet-100 active:scale-95"
            )}
            title="Update AI analyse en geheugen"
          >
            <Zap size={10} className={cn(syncing && "animate-spin")} />
            {syncing ? 'SYNC...' : 'AI SYNC'}
          </button>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-lg">
            Beta
          </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Empty State */}
        {(!data || (data.questions.length === 0 && data.theories.length === 0)) && (
          <div className="py-8 text-center">
            <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Zap size={20} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nog geen nieuwe inzichten.</p>
            <p className="text-[11px] text-gray-400 mt-1">Druk op AI SYNC om je data te analyseren.</p>
          </div>
        )}

        {/* Active Questions */}
        {data && data.questions && data.questions.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare size={10} /> Openstaande Vragen
            </p>
            <div className="space-y-3">
              {data.questions.map(q => (
                <div key={q.id} className="p-3 bg-violet-50 rounded-2xl border border-violet-100 group hover:border-violet-200 transition-colors">
                  <p className="text-sm font-bold text-violet-900 leading-tight mb-1">{q.question}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-violet-500 font-medium capitalize">Module: {q.source_module}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-violet-400">{q.status === 'sent' ? 'Verstuurd naar Telegram' : 'Wacht op verzending'}</span>
                      <Zap size={10} className="text-amber-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Theories / Hypotheses */}
        {data && data.theories && data.theories.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Lightbulb size={10} /> Gedragshypotheses
            </p>
            <div className="space-y-3">
              {data.theories.map(t => {
                const modules = typeof t.source_modules === 'string' ? JSON.parse(t.source_modules) : t.source_modules
                return (
                  <div key={t.id} className="p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-all">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-gray-700 font-medium leading-relaxed">{t.theory}</p>
                      <div className={cn(
                        "text-[10px] px-2 py-1 rounded-full font-bold flex-shrink-0",
                        t.confidence > 0.7 ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {Math.round(t.confidence * 100)}% zeker
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{t.category.replace('_', ' ')}</span>
                      <div className="h-1 w-1 rounded-full bg-gray-200" />
                      <div className="flex gap-1">
                        {Array.isArray(modules) && modules.map((m: string) => (
                          <span key={m} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md font-medium uppercase">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-6 border-t border-gray-50 text-center">
        <Link href="/patterns" className="text-[11px] font-bold text-gray-400 hover:text-violet-500 transition-colors flex items-center gap-1 mx-auto w-fit">
          Alle analyses bekijken <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}
