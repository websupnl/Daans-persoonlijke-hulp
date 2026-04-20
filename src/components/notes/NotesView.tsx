'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileText, Pin, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'
import AIContextButton from '@/components/ai/AIContextButton'

interface Note {
  id: number
  title: string
  content_text: string
  tags: string[]
  pinned: boolean
  updated_at: string
  project_title?: string
  project_color?: string
}

export default function NotesView() {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [smartSearch, setSmartSearch] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingQuick, setSavingQuick] = useState(false)

  const fetchNotes = useCallback(async (query?: string) => {
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    if (smartSearch) params.set('smart', 'true')
    const response = await fetch(`/api/notes?${params.toString()}`)
    const payload = await response.json()
    setNotes(payload.data || [])
    setLoading(false)
  }, [smartSearch])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  useEffect(() => {
    const timer = setTimeout(() => fetchNotes(search), 250)
    return () => clearTimeout(timer)
  }, [search, smartSearch, fetchNotes])

  async function createNote(initial?: { title?: string; content?: string }) {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: initial?.title || 'Naamloze note',
        content: initial?.content || '',
        content_text: initial?.content || '',
      }),
    })
    const payload = await response.json()
    router.push(`/notes/${payload.data.id}`)
  }

  async function saveQuickNote() {
    if (!quickNote.trim() || savingQuick) return
    setSavingQuick(true)
    await createNote({
      title: quickNote.trim().slice(0, 60),
      content: quickNote.trim(),
    })
    setQuickNote('')
    setSavingQuick(false)
  }

  async function deleteNote(id: number, event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes((previous) => previous.filter((note) => note.id !== id))
  }

  const pinned = notes.filter((note) => note.pinned)
  const regular = notes.filter((note) => !note.pinned)
  const recent = notes.slice(0, 6)

  return (
    <PageShell
      title="Notities"
      subtitle={`${notes.length} notities.`}
      actions={
        <button
          onClick={() => createNote()}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
        >
          <Plus size={15} />
          Nieuwe note
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Totaal" value={notes.length} meta="Alles in je kennisbank" icon={<FileText size={18} />} />
        <MetricTile label="Vastgezet" value={pinned.length} meta="Belangrijke referenties" icon={<Pin size={18} />} />
        <MetricTile label="Recent" value={recent.length} meta="Snel terugvinden" icon={<Search size={18} />} />
        <MetricTile label="Met inhoud" value={notes.filter((note) => note.content_text?.trim()).length} meta="Niet leeg opgeslagen" icon={<Sparkles size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <Panel tone="accent">
            <PanelHeader
              eyebrow="Snelle capture"
              title="Vang de gedachte eerst"
              description="Eerst vastleggen, later uitwerken."
            />

            <textarea
              value={quickNote}
              onChange={(event) => setQuickNote(event.target.value)}
              placeholder="Dump hier snel een idee, call note, losse gedachte of projectinzicht..."
              className="mt-5 min-h-[180px] w-full resize-none rounded-xl border border-outline-variant bg-white px-4 py-4 text-sm leading-7 text-on-surface outline-none placeholder:text-on-surface-variant"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={saveQuickNote}
                disabled={!quickNote.trim() || savingQuick}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
              >
                <ArrowRight size={15} />
                {savingQuick ? 'Bezig...' : 'Open in editor'}
              </button>
              <ActionPill>Direct door naar uitwerken</ActionPill>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Zoeken"
              title="Doorzoek je kennisbank"
              description="Zoek op tekst of via AI."
            />

            <div className="mt-5 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-on-surface-variant" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Zoek notities, context of projectinformatie"
                  className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <button
                  onClick={() => setSmartSearch((value) => !value)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    smartSearch ? 'bg-accent text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-high'
                  )}
                >
                  AI
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ActionPill>{smartSearch ? 'Slim zoeken aan' : 'Exact zoeken'}</ActionPill>
              {search && <ActionPill>{`Query: ${search}`}</ActionPill>}
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Recent"
              title="Snel terug"
              description="Je laatste notities op één plek."
            />

            <div className="mt-5 space-y-3">
              {recent.length === 0 ? (
                <EmptyPanel
                  title="Nog geen recente notities"
                  description="Zodra je notities actief gebruikt, horen de laatste items hier meteen als ingang klaar te staan."
                />
              ) : (
                recent.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => router.push(`/notes/${note.id}`)}
                    className="block w-full rounded-xl border border-outline-variant bg-white/70 px-4 py-3.5 text-left transition-colors hover:bg-white"
                  >
                    <p className="truncate text-sm font-semibold text-on-surface">{note.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{formatRelative(note.updated_at)}</p>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {loading ? (
            <Panel className="min-h-[420px] animate-pulse" />
          ) : notes.length === 0 ? (
            <Panel>
              <EmptyPanel
                title="Nog geen notities"
                description="Maak een notitie of gebruik snelle capture."
              />
            </Panel>
          ) : (
            <>
              {pinned.length > 0 && (
                <Panel>
                  <PanelHeader
                    eyebrow="Vastgezet"
                    title="Altijd snel bij de hand"
                    description="Belangrijke notities bovenaan."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {pinned.map((note) => (
                      <NoteCard key={note.id} note={note} onDelete={deleteNote} />
                    ))}
                  </div>
                </Panel>
              )}

              <Panel>
                <PanelHeader
                  eyebrow={pinned.length > 0 ? 'Overige notities' : 'Alle notities'}
                  title={pinned.length > 0 ? 'Werknotities en context' : 'Je notities'}
                  description="Kaarten mogen helpen scannen, maar moeten informatie dragen in plaats van alleen mooi te ogen."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {regular.map((note) => (
                    <NoteCard key={note.id} note={note} onDelete={deleteNote} />
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function NoteCard({
  note,
  onDelete,
}: {
  note: Note
  onDelete: (id: number, event: React.MouseEvent) => void
}) {
  const router = useRouter()

  return (
    <div
      onClick={() => router.push(`/notes/${note.id}`)}
      className="group relative block rounded-xl border border-outline-variant bg-white p-4 text-left shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-low"
    >
      {note.pinned && (
        <div className="absolute right-4 top-4">
          <Pin size={12} className="text-on-surface-variant" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 pr-6 text-sm font-semibold leading-6 text-on-surface">
          {note.title}
        </h3>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
          <AIContextButton type="note" title={note.title} content={note.content_text?.slice(0, 200)} id={note.id} />
          <button
            onClick={(event) => onDelete(note.id, event)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-[#a55a2c]"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <p className="mt-3 min-h-[88px] line-clamp-5 text-sm leading-7 text-on-surface-variant">
        {note.content_text?.trim() || 'Lege note'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {note.tags.slice(0, 3).map((tag) => (
          <ActionPill key={tag}>{tag}</ActionPill>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant pt-4">
        <span className="text-xs text-on-surface-variant">{formatRelative(note.updated_at)}</span>
        {note.project_title && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: `${note.project_color ?? '#5a677b'}18`,
              color: note.project_color ?? '#5a677b',
            }}
          >
            {note.project_title}
          </span>
        )}
      </div>
    </div>
  )
}
