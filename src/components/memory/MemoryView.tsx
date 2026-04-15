'use client'

import { useEffect, useState } from 'react'
import { Brain, Plus, Trash2 } from 'lucide-react'

interface MemoryItem {
  id: number
  key: string
  value: string
  category: string
  confidence: number
  last_reinforced_at: string
}

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function MemoryView() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [keyValue, setKeyValue] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState('personal_context')

  async function load() {
    const res = await fetch('/api/memory')
    const data = await res.json()
    setMemories(data.memories || [])
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!keyValue.trim() || !value.trim()) return
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: keyValue, value, category, confidence: 0.9 }),
    })
    setKeyValue('')
    setValue('')
    load()
  }

  async function remove(id: number) {
    await fetch('/api/memory', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col bg-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gradient">Memory Center</h1>
        <p className="mt-1 text-sm font-medium text-gray-400">Hier zie je wat de AI structureel over jou en je werk onthoudt</p>
      </div>

      <div className="mb-6 rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Brain size={16} className="text-pink-400" />
          <p className="text-sm font-bold text-gray-700">Nieuwe memory</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_180px]">
          <input value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="Key, bijv. uurtarief" className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Waarde" className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none">
            <option value="personal_context">Persoonlijk</option>
            <option value="business_fact">Zakelijk feit</option>
            <option value="project_fact">Projectfeit</option>
            <option value="preference">Voorkeur</option>
            <option value="routine">Routine</option>
            <option value="relationship">Relatie</option>
            <option value="work_pattern">Werkpatroon</option>
          </select>
        </div>
        <button onClick={save} className="mt-3 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ background: GRAD }}>
          <span className="flex items-center gap-2">
            <Plus size={14} />
            Opslaan
          </span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {memories.map((memory) => (
          <div key={memory.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-gray-700">{memory.key}</p>
                <p className="mt-0.5 text-xs text-gray-400">{memory.category}</p>
              </div>
              <button onClick={() => remove(memory.id)} className="text-gray-300 hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{memory.value}</p>
            <p className="mt-3 text-[11px] font-medium text-gray-350">Confidence {Math.round(memory.confidence * 100)}%</p>
          </div>
        ))}
      </div>
    </div>
  )
}
