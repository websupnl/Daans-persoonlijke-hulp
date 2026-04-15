'use client'

import { useState, useEffect } from 'react'
import { Inbox, Plus, Check, Tag, Sparkles } from 'lucide-react'

interface InboxItem {
  id: number
  source: string
  raw_text: string
  parsed_status: string
  suggested_type?: string
  suggested_context?: string
  created_at: string
  processed_at?: string
}

export default function InboxView() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [newText, setNewText] = useState('')
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [triage, setTriage] = useState<Record<number, Record<string, unknown>>>({})

  async function load() {
    const res = await fetch('/api/inbox')
    const data = await res.json()
    setItems(data.items ?? [])
    setPendingCount(data.pendingCount ?? 0)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newText.trim()) return
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: newText }),
    })
    setNewText('')
    load()
  }

  async function handleProcess(id: number) {
    await fetch('/api/inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, parsed_status: 'processed' }),
    })
    load()
  }

  async function handleTriage(item: InboxItem) {
    const res = await fetch('/api/inbox/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: item.raw_text }),
    })
    const data = await res.json()
    if (data.suggestion) {
      setTriage((prev) => ({ ...prev, [item.id]: data.suggestion }))
    }
  }

  const filtered = filter === 'pending' ? items.filter(i => i.parsed_status === 'pending') : items

  const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gradient flex items-center gap-2">
            <Inbox className="w-6 h-6" style={{ color: '#ec4899' }} />
            Inbox
            {pendingCount > 0 && (
              <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm" style={{ background: GRAD }}>{pendingCount}</span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">Snelle captures en onverwerkte ideeën</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('pending')}
            className="px-3 py-1.5 text-xs rounded-xl font-semibold transition-all"
            style={filter === 'pending' ? { background: GRAD, color: '#fff' } : { background: '#f9fafb', color: '#9ca3af' }}
          >
            Onverwerkt
          </button>
          <button
            onClick={() => setFilter('all')}
            className="px-3 py-1.5 text-xs rounded-xl font-semibold transition-all"
            style={filter === 'all' ? { background: GRAD, color: '#fff' } : { background: '#f9fafb', color: '#9ca3af' }}
          >
            Alles
          </button>
        </div>
      </div>

      {/* Quick capture */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Snel iets vastleggen..."
          className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-gray-700 text-sm focus:outline-none focus:border-pink-300 placeholder-gray-400 shadow-sm transition-colors"
        />
        <button
          type="submit"
          className="px-4 py-3 rounded-2xl text-white text-sm font-semibold transition-opacity hover:opacity-90 flex items-center shadow-sm"
          style={{ background: GRAD }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Items */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-gray-400 text-center py-10 font-medium">
            {filter === 'pending' ? 'Inbox leeg! Goed bezig. ✨' : 'Geen items gevonden.'}
          </div>
        ) : filtered.map(item => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${item.parsed_status === 'processed' ? 'border-gray-100 opacity-50' : 'border-gray-100 card-hover'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.parsed_status === 'processed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.raw_text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-400 text-xs font-medium">{new Date(item.created_at).toLocaleDateString('nl-NL')}</span>
                  {item.suggested_type && (
                    <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-semibold">
                      <Tag className="w-3 h-3" />
                      {item.suggested_type}
                    </span>
                  )}
                  {item.suggested_context && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{item.suggested_context}</span>
                  )}
                </div>
              </div>
              {item.parsed_status === 'pending' && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleTriage(item)}
                    className="p-2 text-gray-300 hover:text-pink-500 transition-colors"
                    title="Laat AI triage doen"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleProcess(item.id)}
                    className="p-2 text-gray-300 hover:text-emerald-500 transition-colors"
                    title="Markeer als verwerkt"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            {triage[item.id] && (
              <div className="mt-3 rounded-2xl border border-pink-100 bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 p-3">
                <p className="text-xs font-bold text-gray-700">AI voorstel</p>
                <p className="mt-1 text-xs text-gray-600">Type: {String(triage[item.id].type || 'onbekend')}</p>
                <p className="mt-1 text-xs text-gray-600">Samenvatting: {String(triage[item.id].summary || '')}</p>
                <p className="mt-1 text-xs text-gray-600">Advies: {String(triage[item.id].action_advice || '')}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
