'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, Lightbulb, Plus, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import AIContextButton from '@/components/ai/AIContextButton'

interface Idea {
  id: number
  title: string
  raw_input: string
  refined_summary?: string
  verdict: 'super slim' | 'kansrijk' | 'twijfelachtig' | 'niet waardig' | 'nog beoordelen'
  score: number
  status: 'nieuw' | 'uitwerken' | 'valideren' | 'wachten' | 'archief'
  market_gap?: string
  next_steps: string[]
  tags: string[]
}

const STATUS_OPTIONS = ['nieuw', 'uitwerken', 'valideren', 'wachten', 'archief'] as const
const STATUS_LABELS: Record<Idea['status'], string> = {
  nieuw: 'Nieuw',
  uitwerken: 'Uitwerken',
  valideren: 'Valideren',
  wachten: 'Wachten',
  archief: 'Archief',
}
const VERDICT_COLORS: Record<Idea['verdict'], string> = {
  'super slim': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  kansrijk: 'bg-blue-50 text-blue-700 border-blue-100',
  twijfelachtig: 'bg-amber-50 text-amber-700 border-amber-100',
  'niet waardig': 'bg-red-50 text-red-700 border-red-100',
  'nog beoordelen': 'bg-gray-50 text-gray-600 border-gray-100',
}
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function IdeasView() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [input, setInput] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)

  async function loadIdeas() {
    const res = await fetch('/api/ideas')
    const data = await res.json()
    setIdeas(data.data || [])
    setLoading(false)
  }

  useEffect(() => { loadIdeas() }, [])

  const selectedIdea = useMemo(
    () => ideas.find((idea) => idea.id === selectedId) || ideas[0] || null,
    [ideas, selectedId]
  )

  useEffect(() => {
    if (!selectedId && ideas[0]) setSelectedId(ideas[0].id)
  }, [ideas, selectedId])

  async function createIdea() {
    if (!input.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_input: input }),
    })
    const data = await res.json()
    if (data.data) {
      setIdeas((prev) => [data.data, ...prev])
      setSelectedId(data.data.id)
      setInput('')
    }
    setSaving(false)
  }

  async function updateIdea(id: number, patch: Partial<Idea>) {
    const res = await fetch(`/api/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (data.data) {
      setIdeas((prev) => prev.map((idea) => idea.id === id ? data.data : idea))
    }
  }

  async function deleteIdea(id: number) {
    await fetch(`/api/ideas/${id}`, { method: 'DELETE' })
    const remaining = ideas.filter((idea) => idea.id !== id)
    setIdeas(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="border-b border-gray-100 px-6 py-5">
        <h1 className="text-xl font-extrabold text-gradient">Ideeën</h1>
        <p className="mt-1 text-xs font-medium text-gray-400">Snelle brain dumps met directe AI-analyse en vervolgstappen</p>
      </div>

      <div className="grid flex-1 gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border-b border-gray-100 bg-gray-50/60 p-6 xl:border-b-0 xl:border-r">
          <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-pink-400" />
              <p className="text-sm font-bold text-gray-700">Drop een idee</p>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Bijv: lokale leadmachine voor thuisbatterijen met offerteflow + AI opvolging..."
              className="min-h-[160px] w-full resize-none rounded-2xl border border-white bg-white/90 px-3 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={createIdea}
              disabled={!input.trim() || saving}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: GRAD }}
            >
              <Plus size={14} />
              {saving ? 'Analyseren...' : 'Opslaan en analyseren'}
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Pipeline</p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((status) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{STATUS_LABELS[status]}</span>
                  <span className="font-bold text-gray-700">{ideas.filter((idea) => idea.status === status).length}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
              </div>
            ) : ideas.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
                <Lightbulb size={28} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm text-gray-400">Nog geen ideeën opgeslagen.</p>
              </div>
            ) : (
              ideas.map((idea) => (
                <div
                  key={idea.id}
                  className={cn(
                    'group relative rounded-3xl border p-4 text-left shadow-sm transition-all cursor-pointer',
                    selectedId === idea.id ? 'border-pink-200 bg-white shadow-md' : 'border-gray-200 bg-white hover:border-pink-100'
                  )}
                  onClick={() => { setSelectedId(idea.id); setShowModal(true) }}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold text-gray-700 flex-1">{idea.title}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                        <AIContextButton type="idea" title={idea.title} id={idea.id} />
                      </div>
                      <span className="text-xs font-black text-gradient">{idea.score}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', VERDICT_COLORS[idea.verdict])}>
                      {idea.verdict}
                    </span>
                    <span className="text-[10px] text-gray-400">{STATUS_LABELS[idea.status]}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden xl:block overflow-y-auto p-6">
          <IdeaDetail 
            idea={selectedIdea} 
            onUpdate={updateIdea} 
            onDelete={(id) => { deleteIdea(id); setShowModal(false) }} 
          />
        </div>
      </div>

      {showModal && selectedIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 xl:hidden">
          <div className="relative h-full w-full max-w-2xl overflow-y-auto rounded-3xl bg-gray-50 p-6 shadow-xl">
             <button 
               onClick={() => setShowModal(false)}
               className="absolute right-6 top-6 z-10 rounded-full bg-white p-2 shadow-md"
             >
               <Plus size={20} className="rotate-45" />
             </button>
             <IdeaDetail 
               idea={selectedIdea} 
               onUpdate={updateIdea} 
               onDelete={(id) => { deleteIdea(id); setShowModal(false) }} 
             />
          </div>
        </div>
      )}
    </div>
  )
}

function IdeaDetail({ idea, onUpdate, onDelete }: { idea: Idea | null, onUpdate: (id: number, patch: Partial<Idea>) => void, onDelete: (id: number) => void }) {
  if (!idea) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-16 text-center">
        <Brain size={30} className="mx-auto mb-3 text-gray-200" />
        <p className="text-sm font-medium text-gray-400">Selecteer een idee of maak er eentje aan.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', VERDICT_COLORS[idea.verdict])}>
                {idea.verdict}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                Score {idea.score}/100
              </span>
            </div>
            <input
              value={idea.title}
              onChange={(e) => onUpdate(idea.id, { title: e.target.value })}
              className="w-full bg-transparent text-2xl font-extrabold text-gray-800 outline-none"
            />
          </div>
          <button
            onClick={() => onDelete(idea.id)}
            className="flex items-center gap-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-100"
          >
            <Trash2 size={12} />
            Verwijderen
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card title="Ruwe input">
            <textarea
              value={idea.raw_input}
              onChange={(e) => onUpdate(idea.id, { raw_input: e.target.value })}
              className="min-h-[110px] w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700 outline-none"
            />
          </Card>

          <Card title="AI-samenvatting">
            <textarea
              value={idea.refined_summary || ''}
              onChange={(e) => onUpdate(idea.id, { refined_summary: e.target.value })}
              className="min-h-[160px] w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-700 outline-none"
            />
          </Card>

          <Card title="Marktgat / oordeel">
            <textarea
              value={idea.market_gap || ''}
              onChange={(e) => onUpdate(idea.id, { market_gap: e.target.value })}
              className="min-h-[140px] w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-relaxed text-gray-700 outline-none"
            />
          </Card>

          <Card title="Volgende stappen">
            <div className="space-y-2">
              {idea.next_steps.map((step, index) => (
                <input
                  key={`${idea.id}-${index}`}
                  value={step}
                  onChange={(e) => {
                    const next = [...idea.next_steps]
                    next[index] = e.target.value
                    onUpdate(idea.id, { next_steps: next })
                  }}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none"
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <select
              value={idea.status}
              onChange={(e) => onUpdate(idea.id, { status: e.target.value as Idea['status'] })}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none"
            >
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
          </Card>

          <Card title="Tags">
            <div className="flex flex-wrap gap-2">
              {idea.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-600">
                  {tag}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="mb-3 text-sm font-bold text-gray-700">{title}</p>
      {children}
    </div>
  )
}
