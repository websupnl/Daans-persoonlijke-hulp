'use client'

import { useEffect, useState } from 'react'
import { Brain, Plus, Trash2, Sparkles, Info } from 'lucide-react'

interface MemoryItem {
  id: number
  key: string
  value: string
  category: string
  confidence: number
  last_reinforced_at: string
}

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

const CATEGORY_LABELS: Record<string, string> = {
  personal_context: 'Persoonlijk',
  business_fact: 'Zakelijk',
  project_fact: 'Project',
  preference: 'Voorkeur',
  routine: 'Routine',
  relationship: 'Relatie',
  work_pattern: 'Werkpatroon',
  general: 'Algemeen',
}

const CATEGORY_COLORS: Record<string, string> = {
  personal_context: 'bg-pink-50 text-pink-600',
  business_fact: 'bg-blue-50 text-blue-600',
  project_fact: 'bg-violet-50 text-violet-600',
  preference: 'bg-amber-50 text-amber-600',
  routine: 'bg-emerald-50 text-emerald-600',
  relationship: 'bg-orange-50 text-orange-600',
  work_pattern: 'bg-teal-50 text-teal-600',
  general: 'bg-gray-50 text-gray-500',
}

export default function MemoryView() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [keyValue, setKeyValue] = useState('')
  const [value, setValue] = useState('')
  const [category, setCategory] = useState('personal_context')
  const [showAdd, setShowAdd] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string | null>(null)

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
    setShowAdd(false)
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

  async function generate() {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await fetch('/api/memory/generate', { method: 'POST' })
      const data = await res.json()
      if (data.error) { setGenResult(`Fout: ${data.error}`); return }
      setGenResult(`${data.saved} nieuwe memories opgeslagen uit je data`)
      load()
    } catch {
      setGenResult('Verbindingsfout')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col bg-white p-6">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gradient">Memory Center</h1>
          <p className="mt-1 text-sm font-medium text-gray-400">Wat de AI structureel over jou en je werk onthoudt</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: GRAD }}
          >
            <Sparkles size={14} />
            {generating ? 'Analyseren...' : 'Analyseer mijn data'}
          </button>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border border-gray-200 text-gray-600 hover:border-pink-200 transition-colors"
          >
            <Plus size={14} />
            Handmatig
          </button>
        </div>
      </div>

      {genResult && (
        <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 font-medium">
          ✓ {genResult}
        </div>
      )}

      {/* How it works banner */}
      <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 flex items-start gap-3">
        <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Hoe werkt dit?</strong> De AI vult dit automatisch aan op basis van je gesprekken via Telegram en chat. Klik op <strong>Analyseer mijn data</strong> om memories te genereren uit je bestaande taken, financiën en dagboek. Je kunt ze ook handmatig toevoegen of verwijderen.
        </p>
      </div>

      {showAdd && (
        <div className="mb-5 rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Brain size={16} className="text-pink-400" />
            <p className="text-sm font-bold text-gray-700">Nieuwe memory</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[200px_minmax(0,1fr)_160px]">
            <input value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="Sleutel (bijv. uurtarief)" className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
            <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} placeholder="Waarde" className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ background: GRAD }}>
              <span className="flex items-center gap-2"><Plus size={14} />Opslaan</span>
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">Annuleer</button>
          </div>
        </div>
      )}

      {memories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg" style={{ background: GRAD }}>
            <Brain size={28} />
          </div>
          <p className="text-gray-700 font-bold text-lg mb-2">Nog geen memories opgeslagen</p>
          <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-6">
            Klik op <strong>Analyseer mijn data</strong> om de AI je bestaande taken, financiën en dagboek te laten analyseren en er structurele feiten uit te destilleren.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: GRAD }}
          >
            <Sparkles size={14} />
            {generating ? 'Bezig...' : 'Analyseer mijn data'}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {memories.map((memory) => (
            <div key={memory.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow group">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{memory.key.replace(/_/g, ' ')}</p>
                  <span className={`mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[memory.category] ?? 'bg-gray-50 text-gray-400'}`}>
                    {CATEGORY_LABELS[memory.category] ?? memory.category}
                  </span>
                </div>
                <button onClick={() => remove(memory.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">{memory.value}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex-1 h-1 bg-gray-100 rounded-full mr-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(memory.confidence * 100)}%`, background: GRAD }} />
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{Math.round(memory.confidence * 100)}% zekerheid</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
