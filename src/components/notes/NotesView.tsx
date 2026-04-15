'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pin, FileText, Trash2, Sparkles, ArrowRight } from 'lucide-react'
import { formatRelative } from '@/lib/utils'

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

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function NotesView() {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[]>([])
  const [search, setSearch] = useState('')
  const [quickNote, setQuickNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingQuick, setSavingQuick] = useState(false)

  const fetchNotes = async (q?: string) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/notes${params}`)
    const data = await res.json()
    setNotes(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchNotes() }, [])
  useEffect(() => {
    const timer = setTimeout(() => fetchNotes(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  async function createNote(initial?: { title?: string; content?: string }) {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: initial?.title || 'Naamloze note',
        content: initial?.content || '',
        content_text: initial?.content || '',
      }),
    })
    const data = await res.json()
    router.push(`/notes/${data.data.id}`)
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

  async function deleteNote(id: number, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const pinned = notes.filter((n) => n.pinned)
  const regular = notes.filter((n) => !n.pinned)
  const recent = notes.slice(0, 6)

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-gradient">Notes</h1>
            <p className="mt-1 text-xs font-medium text-gray-400">
              {notes.length} notities, {pinned.length} vastgezet
            </p>
          </div>

          <button
            onClick={() => createNote()}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: GRAD }}
          >
            <Plus size={14} />
            Nieuwe note
          </button>
        </div>
      </div>

      <div className="grid flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-gray-100 bg-gray-50/60 p-6 lg:border-b-0 lg:border-r">
          <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={14} className="text-pink-400" />
              <p className="text-sm font-bold text-gray-700">Snelle capture</p>
            </div>
            <textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Dump hier snel een idee, meeting-notitie of losse gedachte..."
              className="min-h-[120px] w-full resize-none rounded-2xl border border-white bg-white/90 px-3 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={saveQuickNote}
              disabled={!quickNote.trim() || savingQuick}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: GRAD }}
            >
              <ArrowRight size={14} />
              Open in editor
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <Search size={14} className="flex-shrink-0 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek in je kennisbank..."
                className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />
            </div>

            <div className="mt-4 space-y-2">
              <StatLine label="Vastgezet" value={pinned.length} />
              <StatLine label="Met tekst" value={notes.filter((n) => n.content_text?.trim()).length} />
              <StatLine label="Recent bijgewerkt" value={recent.length} />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Recent</p>
            <div className="space-y-2">
              {recent.length === 0 ? (
                <p className="text-xs text-gray-400">Nog geen notes.</p>
              ) : (
                recent.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => router.push(`/notes/${note.id}`)}
                    className="block w-full rounded-2xl border border-gray-100 px-3 py-2 text-left transition-all hover:border-pink-200 hover:bg-pink-50/40"
                  >
                    <p className="truncate text-sm font-semibold text-gray-700">{note.title}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatRelative(note.updated_at)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-16 text-center">
              <FileText size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">{search ? 'Geen notes gevonden.' : 'Nog geen notes. Gebruik links de snelle capture.'}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pinned.length > 0 && (
                <section>
                  <p className="mb-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-pink-500">
                    <Pin size={11} /> Vastgezet
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {pinned.map((note) => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}
                  </div>
                </section>
              )}

              <section>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {pinned.length > 0 ? 'Overige notes' : 'Alle notes'}
                </p>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {regular.map((note) => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="font-bold text-gray-700">{value}</span>
    </div>
  )
}

function NoteCard({ note, onDelete }: { note: Note; onDelete: (id: number, e: React.MouseEvent) => void }) {
  const router = useRouter()

  return (
    <div
      onClick={() => router.push(`/notes/${note.id}`)}
      className="group relative cursor-pointer rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      {note.pinned && (
        <div className="absolute right-4 top-4">
          <Pin size={11} className="text-pink-300" />
        </div>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-sm font-bold text-gray-700">{note.title}</h3>
        <button
          onClick={(e) => onDelete(note.id, e)}
          className="ml-1 p-0.5 text-gray-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <p className="mb-4 line-clamp-4 min-h-[64px] text-xs leading-relaxed text-gray-400">
        {note.content_text?.trim() || 'Lege note'}
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-600">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-medium text-gray-400">{formatRelative(note.updated_at)}</span>
      </div>

      {note.project_title && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <span className="text-[10px] font-semibold" style={{ color: note.project_color ?? '#ec4899' }}>
            {note.project_title}
          </span>
        </div>
      )}
    </div>
  )
}
