'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pin, FileText, Trash2 } from 'lucide-react'
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
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Notes</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{notes.length} notities</p>
        </div>
        <button
          onClick={createNote}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
          style={{ background: GRAD }}
        >
          <Plus size={14} />
          Nieuwe note
        </button>
      </div>

      {/* Search */}
      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5 focus-within:border-pink-300 transition-colors shadow-sm">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoek in notes..."
            className="bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none flex-1"
          />
        </div>
      </div>

      {/* Notes grid */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-medium">{search ? 'Geen notes gevonden.' : 'Nog geen notes. Maak je eerste note aan!'}</p>
          </div>
        ) : (
          <div>
            {pinned.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] text-gradient font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Pin size={9} /> Vastgezet
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pinned.map(note => <NoteCard key={note.id} note={note} onDelete={deleteNote} />)}
                </div>
              </div>
            )}
            {regular.length > 0 && (
              <div>
                {pinned.length > 0 && <p className="text-[10px] text-gradient font-bold uppercase tracking-wider mb-2">Alle notes</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
  const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'
  return (
    <div
      onClick={() => router.push(`/notes/${note.id}`)}
      className="bg-white border border-gray-100 rounded-2xl p-4 cursor-pointer shadow-sm card-hover group relative"
    >
      {note.pinned && (
        <div className="absolute top-3 right-3">
          <Pin size={10} className="text-pink-300" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-bold text-gray-700 line-clamp-1 flex-1">{note.title}</h3>
        <button
          onClick={(e) => onDelete(note.id, e)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-0.5 flex-shrink-0 ml-1"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {note.content_text && (
        <p className="text-xs text-gray-400 line-clamp-3 mb-3 leading-relaxed">{note.content_text.slice(0, 120)}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {note.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full font-semibold text-violet-600 bg-violet-50">{tag}</span>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 font-medium">{formatRelative(note.updated_at)}</span>
      </div>
      {note.project_title && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-semibold" style={{ color: note.project_color ?? '#ec4899' }}>📁 {note.project_title}</span>
        </div>
      )}
    </div>
  )
}
