'use client'

import { useEffect, useState } from 'react'
import PageShell from '@/components/ui/PageShell'
import { EmptyPanel, Panel, PanelHeader } from '@/components/ui/Panel'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'

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
  { key: 'ai', label: 'AI' },
  { key: 'memory', label: 'Geheugen' },
  { key: 'todo', label: 'Taken' },
  { key: 'finance', label: 'Financien' },
  { key: 'note', label: 'Notities' },
  { key: 'event', label: 'Agenda' },
  { key: 'worklog', label: 'Werklog' },
  { key: 'idea', label: 'Ideeen' },
]

const TYPE_COLORS: Record<string, string> = {
  ai: 'bg-violet-50 text-violet-700',
  chat: 'bg-blue-50 text-blue-700',
  memory: 'bg-teal-50 text-teal-700',
  finance: 'bg-orange-50 text-orange-700',
  todo: 'bg-emerald-50 text-emerald-700',
  note: 'bg-amber-50 text-amber-700',
  event: 'bg-violet-50 text-violet-700',
  worklog: 'bg-orange-50 text-orange-700',
  idea: 'bg-pink-50 text-pink-700',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Opgeslagen',
  updated: 'Bijgewerkt',
  deleted: 'Verwijderd',
  started: 'Gestart',
  completed: 'Afgerond',
  failed: 'Fout gegaan',
  memory_saved: 'Onthouden',
  context_refreshed: 'Context vernieuwd',
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action
}

function actionTone(action: string) {
  if (action.includes('fail') || action.includes('error')) return 'bg-red-50 text-red-700 border-red-100'
  if (action === 'deleted') return 'bg-orange-50 text-orange-700 border-orange-100'
  if (action === 'updated' || action === 'context_refreshed') return 'bg-blue-50 text-blue-700 border-blue-100'
  if (action === 'created' || action === 'completed' || action === 'memory_saved') return 'bg-emerald-50 text-emerald-700 border-emerald-100'
  return 'bg-surface-container-low text-on-surface-variant border-outline-variant'
}

function trustLine(item: ActivityItem) {
  if (item.action.includes('fail') || item.action.includes('error')) return 'Actie is mislukt en vraagt controle.'
  if (item.action === 'created') return 'Item is opgeslagen en terug te vinden in de app.'
  if (item.action === 'updated') return 'Wijziging is opgeslagen.'
  if (item.action === 'deleted') return 'Item is verwijderd.'
  if (item.action === 'memory_saved') return 'AI-geheugen is opgeslagen of versterkt.'
  if (item.action === 'context_refreshed') return 'AI-context is vernieuwd.'
  return item.summary || 'Actie is geregistreerd.'
}

export default function TimelineView() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null)

  useEffect(() => {
    setLoading(true)
    const url = filter === 'all' ? '/api/activity?limit=100' : `/api/activity?limit=100&entity_type=${filter}`
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.data || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filter])

  return (
    <PageShell
      title="Timeline"
      subtitle={`${items.length} events. Debug-overzicht van AI, opslag, mutaties en handmatige acties.`}
    >
      <Panel>
        <PanelHeader
          eyebrow="Filter"
          title="Debug events"
          description="Gebruik dit om te zien welke acties echt zijn uitgevoerd, opgeslagen of mislukt."
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={
                filter === item.key
                  ? 'rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-outline-variant bg-white px-4 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low'
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-surface-container-low" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyPanel title="Geen events" description="Zodra acties worden uitgevoerd, verschijnen ze hier als controleerbare events." />
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="cursor-pointer rounded-lg border border-outline-variant bg-white p-4 shadow-[0_12px_30px_-24px_rgba(31,37,35,0.18)] transition-colors hover:bg-surface-container-low"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLORS[item.entity_type] ?? 'bg-surface-container-low text-on-surface-variant'}`}>
                    {item.entity_type}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${actionTone(item.action)}`}>
                    {actionLabel(item.action)}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(item.created_at).toLocaleString('nl-NL')}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-on-surface">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">{trustLine(item)}</p>
                {item.summary && item.summary !== trustLine(item) && (
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">{item.summary}</p>
                )}
              </div>
            ))
          )}
        </div>
      </Panel>

      <AppDetailDrawer
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        eyebrow="Debug event"
        title={selectedItem?.title}
        subtitle={selectedItem?.summary || 'Gebeurtenis in het systeem.'}
        status={selectedItem?.entity_type}
        fields={[
          { label: 'Actie', value: selectedItem ? actionLabel(selectedItem.action) : '-' },
          { label: 'Status', value: selectedItem ? trustLine(selectedItem) : '-' },
          { label: 'Type', value: selectedItem?.entity_type },
          { label: 'Entity ID', value: selectedItem?.entity_id ?? '-' },
          { label: 'Moment', value: selectedItem?.created_at ? new Date(selectedItem.created_at).toLocaleString('nl-NL') : '-' },
        ]}
      >
        {selectedItem && Object.keys(selectedItem.metadata || {}).length > 0 && (
          <Panel tone="muted">
            <PanelHeader eyebrow="Metadata" title="Extra context" />
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-on-surface-variant">
              {JSON.stringify(selectedItem.metadata, null, 2)}
            </pre>
          </Panel>
        )}
      </AppDetailDrawer>
    </PageShell>
  )
}
