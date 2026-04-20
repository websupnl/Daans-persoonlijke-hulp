'use client'

import { useState, useEffect } from 'react'
import { Check, Plus, Sparkles } from 'lucide-react'
import { Textarea } from '@/components/ui/interfaces-textarea'
import PageShell from '@/components/ui/PageShell'
import { Divider, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'

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
  const [saving, setSaving] = useState(false)

  async function load() {
    const response = await fetch('/api/inbox')
    const payload = await response.json()
    setItems(payload.items ?? [])
    setPendingCount(payload.pendingCount ?? 0)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!newText.trim() || saving) return
    setSaving(true)
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: newText }),
    })
    setNewText('')
    setSaving(false)
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
    const response = await fetch('/api/inbox/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: item.raw_text }),
    })
    const payload = await response.json()
    if (payload.suggestion) {
      setTriage((previous) => ({ ...previous, [item.id]: payload.suggestion }))
    }
  }

  const filteredItems = filter === 'pending' ? items.filter((item) => item.parsed_status === 'pending') : items
  const processedCount = items.filter((item) => item.parsed_status === 'processed').length

  return (
    <PageShell
      title="Inbox"
      subtitle={`${pendingCount} onverwerkt.`}
    >
      <StatStrip stats={[
        { label: 'Onverwerkt', value: pendingCount, accent: pendingCount > 0 ? 'amber' : undefined },
        { label: 'Verwerkt', value: processedCount, accent: 'green' },
        { label: 'Totaal', value: items.length },
      ]} />

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="accent">
            <PanelHeader
              eyebrow="Capture"
              title="Snel toevoegen"
            />
            <form onSubmit={handleAdd} className="mt-4 space-y-3">
              <Textarea
                value={newText}
                onChange={(event) => setNewText(event.target.value)}
                placeholder="Snel iets vastleggen: idee, follow-up, losse taak, belofte, notitie..."
                className="min-h-[120px] resize-none rounded-lg border-outline-variant bg-white px-3.5 py-3 text-sm leading-6 text-on-surface placeholder:text-on-surface-variant"
              />
              <button
                type="submit"
                disabled={!newText.trim() || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={13} />
                {saving ? 'Opslaan...' : 'Toevoegen'}
              </button>
            </form>
          </Panel>

          <Panel tone="muted">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Filter</p>
            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => setFilter('pending')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === 'pending' ? 'bg-accent text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                Onverwerkt
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === 'all' ? 'bg-accent text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                Alles
              </button>
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            eyebrow={`${filteredItems.length} items`}
            title={filter === 'pending' ? 'Open items' : 'Alle items'}
          />

          <div className="mt-4">
            {filteredItems.length === 0 ? (
              <EmptyPanel
                title={filter === 'pending' ? 'Inbox leeg' : 'Geen items gevonden'}
                description={filter === 'pending' ? 'Geen losse eindes meer. Dat is goed nieuws.' : 'In deze filter staat nu niets zichtbaar.'}
              />
            ) : (
              filteredItems.map((item, index) => (
                <div key={item.id}>
                  {index > 0 && <Divider />}
                  <div className="rounded-lg px-2 py-3 transition-colors hover:bg-surface-container-low/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-6 ${item.parsed_status === 'processed' ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                          {item.raw_text}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                            {new Date(item.created_at).toLocaleDateString('nl-NL')}
                          </span>
                          {item.suggested_type && (
                            <span className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                              {item.suggested_type}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.parsed_status === 'pending' && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => handleTriage(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant transition-colors hover:bg-surface-container-low"
                            title="AI triage"
                          >
                            <Sparkles size={13} />
                          </button>
                          <button
                            onClick={() => handleProcess(item.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-[#2a3230]"
                            title="Markeer als verwerkt"
                          >
                            <Check size={13} />
                          </button>
                        </div>
                      )}
                    </div>

                    {triage[item.id] && (
                      <div className="mt-3 rounded-lg border border-outline-variant bg-surface-container-low px-3.5 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">AI voorstel</p>
                        <div className="mt-2 space-y-1 text-sm leading-6 text-on-surface">
                          <p><span className="font-semibold">Type:</span> {String(triage[item.id].type || 'onbekend')}</p>
                          <p><span className="font-semibold">Samenvatting:</span> {String(triage[item.id].summary || '')}</p>
                          <p><span className="font-semibold">Advies:</span> {String(triage[item.id].action_advice || '')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </PageShell>
  )
}
