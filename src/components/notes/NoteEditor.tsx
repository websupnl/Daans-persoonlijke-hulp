'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { ArrowLeft, Pin, Bold, Italic, UnderlineIcon, List, CheckSquare, Heading2, Trash2 } from 'lucide-react'
import { cn, formatDateFull } from '@/lib/utils'

interface NoteData {
  id: number
  title: string
  content: string
  tags: string[]
  pinned: boolean
  updated_at: string
}

export default function NoteEditor({ id }: { id: string }) {
  const router = useRouter()
  const [note, setNote] = useState<NoteData | null>(null)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: 'Begin met schrijven...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: { attributes: { class: 'tiptap' } },
    onUpdate: ({ editor }) => {
      debouncedSave(title, editor.getHTML(), editor.getText())
    },
  })

  const saveNote = useCallback(async (t: string, content: string, contentText: string, tags?: string[], pinned?: boolean) => {
    setSaving(true)
    await fetch(`/api/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t, content, content_text: contentText, ...(tags !== undefined ? { tags } : {}), ...(pinned !== undefined ? { pinned } : {}) }),
    })
    setTimeout(() => setSaving(false), 500)
  }, [id])

  const debouncedSave = useCallback((t: string, content: string, contentText: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveNote(t, content, contentText), 800)
  }, [saveNote])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    fetch(`/api/notes/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setNote(d.data)
          setTitle(d.data.title === 'Naamloze note' ? '' : d.data.title)
          editor?.commands.setContent(d.data.content || '')
        }
      })
  }, [id, editor])

  async function togglePin() {
    if (!note) return
    const newPinned = !note.pinned
    await saveNote(title || 'Naamloze note', editor?.getHTML() || '', editor?.getText() || '', note.tags, newPinned)
    setNote(n => n ? { ...n, pinned: newPinned } : n)
  }

  async function deleteNote() {
    if (!confirm('Note verwijderen?')) return
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    router.push('/notes')
  }

  async function addTag(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !tagInput.trim() || !note) return
    const newTags = [...note.tags, tagInput.trim()]
    setNote(n => n ? { ...n, tags: newTags } : n)
    setTagInput('')
    await saveNote(title || 'Naamloze note', editor?.getHTML() || '', editor?.getText() || '', newTags)
  }

  async function removeTag(tag: string) {
    if (!note) return
    const newTags = note.tags.filter(t => t !== tag)
    setNote(n => n ? { ...n, tags: newTags } : n)
    await saveNote(title || 'Naamloze note', editor?.getHTML() || '', editor?.getText() || '', newTags)
  }

  if (!editor) return null

  const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0 bg-white">
        <button onClick={() => router.push('/notes')} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-1 flex-1">
          {[
            { icon: Bold, cmd: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
            { icon: Italic, cmd: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
            { icon: UnderlineIcon, cmd: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline') },
            { icon: Heading2, cmd: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
            { icon: List, cmd: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
            { icon: CheckSquare, cmd: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList') },
          ].map(({ icon: Icon, cmd, active }, i) => (
            <button
              key={i}
              onClick={cmd}
              className={cn('p-1.5 rounded-lg transition-all', active ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
              style={active ? { background: GRAD } : {}}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {saving && <span className="text-[10px] text-gray-400 animate-pulse-soft font-medium">Opslaan...</span>}
          <button
            onClick={togglePin}
            className={cn('p-1.5 rounded-lg transition-colors', note?.pinned ? 'text-amber-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
          >
            <Pin size={14} />
          </button>
          <button onClick={deleteNote} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl w-full mx-auto">
        <input
          value={title}
          onChange={e => {
            setTitle(e.target.value)
            debouncedSave(e.target.value || 'Naamloze note', editor.getHTML(), editor.getText())
          }}
          placeholder="Titel..."
          className="w-full bg-transparent text-2xl font-extrabold text-gradient placeholder:text-gray-200 outline-none mb-4"
        />

        {note && (
          <p className="text-xs text-gray-400 mb-4 font-medium">Laatst bijgewerkt: {formatDateFull(note.updated_at)}</p>
        )}

        <EditorContent editor={editor} className="text-gray-700 text-sm" />

        {/* Tags */}
        <div className="mt-8 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {note?.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full font-semibold">
                {tag}
                <button onClick={() => removeTag(tag)} className="text-violet-300 hover:text-red-400 ml-0.5 font-bold">×</button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder="+ tag toevoegen"
              className="text-xs bg-transparent text-gray-400 placeholder:text-gray-300 outline-none w-28"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
