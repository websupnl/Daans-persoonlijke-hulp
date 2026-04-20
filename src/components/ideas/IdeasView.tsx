'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, Lightbulb, Sparkles, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import AIContextButton from '@/components/ai/AIContextButton'
import { EditableChip } from '@/components/ui/editable-chip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/interfaces-select'
import { Textarea } from '@/components/ui/interfaces-textarea'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, Divider, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'

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
const VERDICT_CLASSES: Record<Idea['verdict'], string> = {
  'super slim': 'bg-emerald-50 text-emerald-700',
  kansrijk: 'bg-blue-50 text-blue-700',
  twijfelachtig: 'bg-amber-50 text-amber-700',
  'niet waardig': 'bg-red-50 text-red-700',
  'nog beoordelen': 'bg-surface-container text-on-surface-variant',
}

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
      setIdeas((prev) => prev.map((idea) => (idea.id === id ? data.data : idea)))
    }
  }

  async function deleteIdea(id: number) {
    await fetch(`/api/ideas/${id}`, { method: 'DELETE' })
    const remaining = ideas.filter((idea) => idea.id !== id)
    setIdeas(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  const byStatus = (status: Idea['status']) => ideas.filter((i) => i.status === status).length

  return (
    <PageShell
      title="Ideeën"
      subtitle={`${ideas.length} ideeën opgeslagen.`}
      actions={
        <button
          onClick={() => { if (ideas[0]) { setSelectedId(ideas[0].id); setShowModal(true) } }}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-low"
        >
          <Brain size={14} />
          Details
        </button>
      }
    >
      <StatStrip stats={STATUS_OPTIONS.map((s) => ({ label: STATUS_LABELS[s], value: byStatus(s) }))} />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel tone="accent">
            <PanelHeader
              eyebrow="Brain dump"
              title="Drop een idee"
              description="AI analyseert en scoort je idee automatisch."
            />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Bijv: lokale leadmachine voor thuisbatterijen met offerteflow + AI opvolging..."
              className="mt-4 min-h-[140px] resize-none rounded-lg border-outline-variant bg-white px-3.5 py-3 text-sm leading-6 text-on-surface placeholder:text-on-surface-variant"
            />
            <div className="mt-3">
              <button
                onClick={createIdea}
                disabled={!input.trim() || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles size={13} />
                {saving ? 'Analyseren...' : 'Opslaan en analyseren'}
              </button>
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Pipeline" title="Alle ideeën" />
            <div className="mt-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-container-low my-1" />
                ))
              ) : ideas.length === 0 ? (
                <EmptyPanel title="Nog geen ideeën" description="Dump hierboven je eerste idee." />
              ) : (
                ideas.map((idea, index) => (
                  <div key={idea.id}>
                    {index > 0 && <Divider />}
                    <div
                      className={cn(
                        'group flex cursor-pointer items-start gap-3 rounded-lg px-2 py-3 transition-colors',
                        selectedId === idea.id ? 'bg-surface-container-low' : 'hover:bg-surface-container-low/60'
                      )}
                      onClick={() => { setSelectedId(idea.id); setShowModal(true) }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold text-on-surface">{idea.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', VERDICT_CLASSES[idea.verdict])}>
                            {idea.verdict}
                          </span>
                          <span className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                            {STATUS_LABELS[idea.status]}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <div className="opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <AIContextButton type="idea" title={idea.title} id={idea.id} />
                        </div>
                        <span className="text-xs font-bold text-on-surface-variant">{idea.score}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="hidden xl:block">
          <IdeaDetail
            idea={selectedIdea}
            onUpdate={updateIdea}
            onDelete={(id) => { deleteIdea(id); setShowModal(false) }}
          />
        </div>
      </div>

      {showModal && selectedIdea && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 xl:hidden sm:items-center sm:p-4">
          <div className="relative h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface-container-lowest p-6 shadow-xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low"
            >
              <X size={15} />
            </button>
            <IdeaDetail
              idea={selectedIdea}
              onUpdate={updateIdea}
              onDelete={(id) => { deleteIdea(id); setShowModal(false) }}
            />
          </div>
        </div>
      )}
    </PageShell>
  )
}

function IdeaDetail({
  idea,
  onUpdate,
  onDelete,
}: {
  idea: Idea | null
  onUpdate: (id: number, patch: Partial<Idea>) => void
  onDelete: (id: number) => void
}) {
  if (!idea) {
    return (
      <Panel>
        <EmptyPanel
          title="Selecteer een idee"
          description="Klik op een idee in de lijst om de details te zien."
        />
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold', VERDICT_CLASSES[idea.verdict])}>
                {idea.verdict}
              </span>
              <ActionPill>Score {idea.score}/100</ActionPill>
            </div>
            <EditableChip
              defaultLabel={idea.title}
              onChange={(value) => onUpdate(idea.id, { title: value })}
              className="max-w-full"
            />
          </div>
          <button
            onClick={() => onDelete(idea.id)}
            className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={11} />
            Verwijderen
          </button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <FieldPanel title="Ruwe input">
            <Textarea
              value={idea.raw_input}
              onChange={(e) => onUpdate(idea.id, { raw_input: e.target.value })}
              className="min-h-[100px] resize-none rounded-lg border-outline-variant bg-surface-container-low px-3.5 py-3 text-sm leading-6 text-on-surface"
            />
          </FieldPanel>

          <FieldPanel title="AI-samenvatting">
            <Textarea
              value={idea.refined_summary || ''}
              onChange={(e) => onUpdate(idea.id, { refined_summary: e.target.value })}
              className="min-h-[120px] resize-none rounded-lg border-outline-variant bg-surface-container-low px-3.5 py-3 text-sm leading-6 text-on-surface"
            />
          </FieldPanel>

          <FieldPanel title="Marktgat / oordeel">
            <Textarea
              value={idea.market_gap || ''}
              onChange={(e) => onUpdate(idea.id, { market_gap: e.target.value })}
              className="min-h-[100px] resize-none rounded-lg border-outline-variant bg-surface-container-low px-3.5 py-3 text-sm leading-6 text-on-surface"
            />
          </FieldPanel>

          <FieldPanel title="Volgende stappen">
            <div className="space-y-1.5">
              {idea.next_steps.map((step, index) => (
                <input
                  key={`${idea.id}-${index}`}
                  value={step}
                  onChange={(e) => {
                    const next = [...idea.next_steps]
                    next[index] = e.target.value
                    onUpdate(idea.id, { next_steps: next })
                  }}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3.5 py-2 text-sm text-on-surface outline-none"
                />
              ))}
            </div>
          </FieldPanel>
        </div>

        <div className="space-y-3">
          <FieldPanel title="Status">
            <Select
              value={idea.status}
              onValueChange={(value) => onUpdate(idea.id, { status: value as Idea['status'] })}
            >
              <SelectTrigger className="w-full rounded-lg bg-surface-container-low px-3.5 py-2 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>{STATUS_LABELS[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldPanel>

          <FieldPanel title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {idea.tags.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Geen tags</p>
              ) : (
                idea.tags.map((tag) => (
                  <ActionPill key={tag}>{tag}</ActionPill>
                ))
              )}
            </div>
          </FieldPanel>
        </div>
      </div>
    </div>
  )
}

function FieldPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel>
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">{title}</p>
      {children}
    </Panel>
  )
}
