'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'

type SearchResults = Record<string, Array<Record<string, unknown>>>

const GROUP_LABELS: Record<string, string> = {
  todos: 'Todos',
  notes: 'Notes',
  contacts: 'Contacten',
  projects: 'Projecten',
  ideas: 'Ideeën',
  worklogs: 'Werklogs',
  events: 'Agenda',
  finance: 'Financiën',
  memories: 'Memory',
  chats: 'Chat',
}

const GROUP_LINKS: Record<string, string> = {
  todos: '/todos',
  notes: '/notes',
  contacts: '/contacts',
  projects: '/projects',
  ideas: '/ideas',
  worklogs: '/worklogs',
  events: '/agenda',
  finance: '/finance',
  memories: '/memory',
  chats: '/chat',
}

export default function SearchView() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResults>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!q.trim()) {
        setResults({})
        return
      }
      setLoading(true)
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.data || {})
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [q])

  const hasResults = Object.values(results).some((items) => items?.length)

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col bg-white p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-gradient">Zoeken</h1>
        <p className="mt-1 text-sm font-medium text-gray-400">Zoek door je hele systeem heen, niet alleen per losse module</p>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4 shadow-sm">
        <Search size={18} className="text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op project, contact, onderwerp, bedrijf of context..."
          className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
        </div>
      ) : !q.trim() ? (
        <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Typ iets als `WebsUp`, `Sita`, `thuisbatterijen` of `Bouma`.</p>
        </div>
      ) : !hasResults ? (
        <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-400">Geen resultaten gevonden voor &quot;{q}&quot;.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {Object.entries(results).map(([group, items]) => (
            items?.length ? (
              <div key={group} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">{GROUP_LABELS[group] || group}</p>
                  <Link href={GROUP_LINKS[group] || '/'} className="text-xs font-semibold text-gradient">Openen</Link>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 8).map((item, index) => (
                    <div key={`${group}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                      <p className="text-sm font-semibold text-gray-700">
                        {String(item.title || item.name || item.key || item.content || item.role || 'Resultaat')}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {String(item.summary || item.company || item.category || item.type || item.context || item.value || '')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  )
}
