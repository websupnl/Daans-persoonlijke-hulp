'use client'

import { useState, useEffect } from 'react'
import { Inbox, Plus, Check, Tag } from 'lucide-react'

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

  const filtered = filter === 'pending' ? items.filter(i => i.parsed_status === 'pending') : items

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Inbox className="w-6 h-6" />
            Inbox
            {pendingCount > 0 && <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>}
          </h1>
          <p className="text-gray-400 text-sm mt-1">Snelle captures en onverwerkte ideeën</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('pending')} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === 'pending' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Onverwerkt</button>
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>Alles</button>
        </div>
      </div>

      {/* Quick capture */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          placeholder="Snel iets vastleggen..."
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-600"
        />
        <button type="submit" className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Items */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-gray-500 text-center py-10">
            {filter === 'pending' ? 'Inbox leeg! Goed bezig.' : 'Geen items gevonden.'}
          </div>
        ) : filtered.map(item => (
          <div key={item.id} className={`bg-gray-900 rounded-xl p-4 border transition-colors ${item.parsed_status === 'processed' ? 'border-gray-800 opacity-60' : 'border-gray-700'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.parsed_status === 'processed' ? 'text-gray-500 line-through' : 'text-white'}`}>{item.raw_text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-600 text-xs">{new Date(item.created_at).toLocaleDateString('nl-NL')}</span>
                  {item.suggested_type && (
                    <span className="flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md">
                      <Tag className="w-3 h-3" />
                      {item.suggested_type}
                    </span>
                  )}
                  {item.suggested_context && (
                    <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-md">{item.suggested_context}</span>
                  )}
                </div>
              </div>
              {item.parsed_status === 'pending' && (
                <button onClick={() => handleProcess(item.id)} className="shrink-0 p-2 text-gray-500 hover:text-emerald-400 transition-colors" title="Markeer als verwerkt">
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
