'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pin, FileText, Trash2 } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'

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
  const [loading, setLoading] = useState(true)

  const fetchNotes = async (q?: string) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/notes${params}`)
    const data = await res.json()
    setNotes(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchNotes() }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchNotes(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function createNote() {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Naamloze note', content: '', content_text: '' }),
    })
    const data = await res.json()
    router.push(`/notes/${data.data.id}`)
  }

  async function deleteNote(id: number, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const pinned = notes.filter(n => n.pinned)
  const regular = notes.filter(n => !n.pinned)

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Notes</h1>
          <p className="text-xs text-slate-500 mt-0.5">{notes.length} notities</p>
        </div>
        <button onClick={createNote} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 transition-colors">
          <Plus size={14} />
          Nieuwe note
        </button>
      </div>

      {/* Search */}
      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-[#13151c] border border-white/10 rounded-xl px-3 py-2 focus-within:border-brand-600/50 transition-colors">
          <Search size={14} className="text-slate-600 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek in notes..."
            className="bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none flex-1"
          />
        </div>
      </div>

      {/* Notes grid */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">{search ? 'Geen notes gevonden.' : 'Nog geen notes. Maak je eerste note aan!'}</p>
          </div>
        ) : (
          <div>
            {pinned.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Pin size={9} /> Vastgezet
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {pinned.map(note => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}
                </div>
              </div>
            )}
            {regular.length > 0 && (
              <div>
                {pinned.length > 0 && <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider mb-2">Alle notes</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {regular.map(note => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onDelete }: { note: Note; onDelete: (id: number, e: React.MouseEvent) => void }) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/notes/${note.id}`)}
      className="bg-[#13151c] border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/10 hover:-translate-y-0.5 transition-all duration-150 group relative"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-slate-200 line-clamp-1">{note.title}</h3>
        <button
          onClick={(e) => onDelete(note.id, e)}
          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-0.5 flex-shrink-0"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {note.content_text && (
        <p className="text-xs text-slate-600 line-clamp-3 mb-2">{note.content_text.slice(0, 120)}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/5 text-slate-500 rounded">{tag}</span>
          ))}
        </div>
        <span className="text-[10px] text-slate-700">{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  )
}
