'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import PageShell from '@/components/ui/PageShell'
import { Divider, EmptyPanel, Panel, PanelHeader } from '@/components/ui/Panel'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'

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
  const [selectedResult, setSelectedResult] = useState<{ group: string; item: Record<string, unknown> } | null>(null)

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
    <PageShell
      title="Zoeken"
      subtitle="Doorzoek je hele systeem in één zoekopdracht."
    >
      <Panel tone="muted" padding="sm">
        <div className="flex items-center gap-3 px-2 py-1">
          <Search size={16} className="shrink-0 text-on-surface-variant" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op project, contact, onderwerp, bedrijf of context..."
            className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
            autoFocus
          />
        </div>
      </Panel>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-container-low" />
          ))}
        </div>
      ) : !q.trim() ? (
        <EmptyPanel
          title="Begin met zoeken"
          description="Typ iets als 'WebsUp', 'Sita', 'thuisbatterijen' of 'Bouma'."
        />
      ) : !hasResults ? (
        <EmptyPanel
          title="Geen resultaten"
          description={`Niets gevonden voor "${q}". Probeer een andere zoekterm.`}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(results).map(([group, items]) =>
            items?.length ? (
              <Panel key={group}>
                <PanelHeader
                  eyebrow={GROUP_LABELS[group] || group}
                  title={`${items.length} ${items.length === 1 ? 'resultaat' : 'resultaten'}`}
                  action={
                    <Link
                      href={GROUP_LINKS[group] || '/'}
                      className="rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container"
                    >
                      Openen
                    </Link>
                  }
                />
                <div className="mt-3">
                  {items.slice(0, 8).map((item, index) => (
                    <div key={`${group}-${index}`}>
                      {index > 0 && <Divider />}
                      <div
                        onClick={() => setSelectedResult({ group, item })}
                        className="cursor-pointer rounded-lg px-2 py-2.5 hover:bg-surface-container-low/60"
                      >
                        <p className="text-sm font-semibold text-on-surface">
                          {String(item.title || item.name || item.key || item.content || item.role || 'Resultaat')}
                        </p>
                        <p className="mt-0.5 text-xs text-on-surface-variant">
                          {String(item.summary || item.company || item.category || item.type || item.context || item.value || '')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : null
          )}
        </div>
      )}
      <AppDetailDrawer
        open={!!selectedResult}
        onClose={() => setSelectedResult(null)}
        eyebrow={selectedResult ? GROUP_LABELS[selectedResult.group] || selectedResult.group : 'Resultaat'}
        title={selectedResult ? String(selectedResult.item.title || selectedResult.item.name || selectedResult.item.key || selectedResult.item.content || selectedResult.item.role || 'Resultaat') : 'Resultaat'}
        subtitle={selectedResult ? String(selectedResult.item.summary || selectedResult.item.company || selectedResult.item.category || selectedResult.item.type || selectedResult.item.context || selectedResult.item.value || '') : undefined}
        status={selectedResult?.group}
        primaryHref={selectedResult ? GROUP_LINKS[selectedResult.group] || '/' : undefined}
        primaryLabel="Open module"
        fields={selectedResult ? Object.entries(selectedResult.item)
          .filter(([key]) => !['title', 'name', 'summary', 'content'].includes(key))
          .slice(0, 8)
          .map(([key, value]) => ({ label: key, value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-') })) : []}
      />
    </PageShell>
  )
}
