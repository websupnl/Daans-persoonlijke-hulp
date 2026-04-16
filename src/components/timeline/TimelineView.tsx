'use client'

import { useEffect, useState } from 'react'

interface ActivityItem {
  id: number
  entity_type: string
  entity_id?: number
  action: string
  title: string
  summary?: string
  metadata: Record<string, unknown>
  created_at: string
}

export default function TimelineView() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const FILTERS = [
    { key: 'all', label: 'Alles' },
    { key: 'chat', label: 'Chat' },
    { key: 'todo', label: 'Todos' },
    { key: 'note', label: 'Notes' },
    { key: 'event', label: 'Agenda' },
    { key: 'worklog', label: 'Werklog' },
    { key: 'idea', label: 'Ideeën' },
  ]

  useEffect(() => {
    setLoading(true)
    const url = filter === 'all' ? '/api/activity?limit=100' : `/api/activity?limit=100&entity_type=${filter}`
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.data || [])
        setLoading(false)
      })
  }, [filter])

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col bg-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gradient">Timeline</h1>
        <p className="mt-1 text-sm font-medium text-gray-400">Eén tijdlijn over chat, inbox, todos, notes, agenda, werklog, memory en ideeën</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              filter === f.key ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{item.entity_type}</span>
                <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-500">{item.action}</span>
                <span className="text-[11px] text-gray-350">{new Date(item.created_at).toLocaleString('nl-NL')}</span>
              </div>
              <p className="text-sm font-bold text-gray-700">{item.title}</p>
              {item.summary && <p className="mt-1 text-sm text-gray-500">{item.summary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
