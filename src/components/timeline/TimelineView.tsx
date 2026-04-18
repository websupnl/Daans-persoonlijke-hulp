'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, Panel, PanelHeader } from '@/components/ui/Panel'

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

const FILTERS = [
  { key: 'all', label: 'Alles' },
  { key: 'chat', label: 'Chat' },
  { key: 'todo', label: 'Todos' },
  { key: 'note', label: 'Notes' },
  { key: 'event', label: 'Agenda' },
  { key: 'worklog', label: 'Werklog' },
  { key: 'idea', label: 'Ideeën' },
]

const TYPE_COLORS: Record<string, string> = {
  chat: 'bg-blue-50 text-blue-700',
  todo: 'bg-emerald-50 text-emerald-700',
  note: 'bg-amber-50 text-amber-700',
  event: 'bg-violet-50 text-violet-700',
  worklog: 'bg-orange-50 text-orange-700',
  idea: 'bg-pink-50 text-pink-700',
}

export default function TimelineView() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

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
    <PageShell
      title="Timeline"
      subtitle={`${items.length} activiteiten. Eén tijdlijn over chat, inbox, todos, notes, agenda, werklog, memory en ideeën.`}
    >
      <Panel>
        <PanelHeader
          eyebrow="Filter"
          title="Activiteiten"
          description="Alles wat je hebt gedaan in één overzicht."
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? 'rounded-full bg-[#202625] px-4 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-black/5 bg-white px-4 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low'
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-[20px] bg-surface-container-low" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyPanel
              title="Geen activiteiten"
              description="Zodra je acties uitvoert in andere modules verschijnen ze hier."
            />
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-black/5 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(31,37,35,0.18)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[item.entity_type] ?? 'bg-surface-container-low text-on-surface-variant'}`}>
                    {item.entity_type}
                  </span>
                  <ActionPill>{item.action}</ActionPill>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(item.created_at).toLocaleString('nl-NL')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{item.title}</p>
                {item.summary && <p className="mt-1 text-sm leading-6 text-on-surface-variant">{item.summary}</p>}
              </div>
            ))
          )}
        </div>
      </Panel>
    </PageShell>
  )
}
