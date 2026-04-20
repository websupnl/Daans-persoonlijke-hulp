'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Mail, Phone, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import AIContextButton from '@/components/ai/AIContextButton'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, Divider, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'

interface Contact {
  id: number
  name: string
  type: 'persoon' | 'bedrijf'
  email?: string
  phone?: string
  company?: string
  tags: string[]
  last_contact?: string
}

const EMPTY: Contact = { id: 0, name: '', type: 'persoon', email: '', phone: '', company: '', tags: [] }

export default function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)

  const fetchContacts = async (q?: string) => {
    const params = q ? `?search=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/contacts${params}`)
    const data = await res.json()
    setContacts(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchContacts() }, [])
  useEffect(() => {
    const t = setTimeout(() => fetchContacts(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (selected) {
      fetch(`/api/contacts/${selected}`).then((r) => r.json()).then((d) => setDetail(d.data))
    }
  }, [selected])

  async function saveContact() {
    if (!form.name.trim()) return
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tags: form.tags }),
    })
    setForm({ ...EMPTY })
    setShowAdd(false)
    fetchContacts()
  }

  async function deleteContact(id: number) {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    setContacts((prev) => prev.filter((c) => c.id !== id))
    if (selected === id) setSelected(null)
  }

  const persons = contacts.filter((c) => c.type === 'persoon')
  const companies = contacts.filter((c) => c.type === 'bedrijf')

  return (
    <PageShell
      title="Contacten"
      subtitle={`${contacts.length} contacten.`}
      actions={
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
        >
          <Plus size={14} />
          Nieuw contact
        </button>
      }
    >
      <StatStrip stats={[
        { label: 'Totaal', value: contacts.length },
        { label: 'Personen', value: persons.length },
        { label: 'Bedrijven', value: companies.length },
      ]} />

      {showAdd && (
        <Panel tone="accent">
          <PanelHeader eyebrow="Nieuw contact" title="Voeg een contact toe" />
          <div className="mt-4 space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Naam *" className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
              <input value={form.company || ''} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} placeholder="Bedrijf" className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
              <input value={form.email || ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
              <input value={form.phone || ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefoon" className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
            </div>
            <div className="flex gap-1.5">
              {(['persoon', 'bedrijf'] as const).map((t) => (
                <button key={t} onClick={() => setForm((p) => ({ ...p, type: t }))} className={cn('rounded-lg px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors', form.type === t ? 'bg-accent text-white' : 'border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={saveContact} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]">Opslaan</button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low">Annuleer</button>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Panel tone="muted" padding="sm">
            <div className="flex items-center gap-2 px-2 py-1">
              <Search size={14} className="shrink-0 text-on-surface-variant" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek contacten..."
                className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Contactenlijst"
              title={search ? `"${search}"` : 'Alle contacten'}
            />

            <div className="mt-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-container-low my-1" />
                ))
              ) : contacts.length === 0 ? (
                <EmptyPanel title="Geen contacten gevonden" description="Voeg een nieuw contact toe of pas je zoekopdracht aan." />
              ) : (
                contacts.map((c, index) => (
                  <div key={c.id}>
                    {index > 0 && <Divider />}
                    <div
                      onClick={() => { setSelected(c.id); setDetail(null); setShowDetail(true) }}
                      className={cn(
                        'group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors',
                        selected === c.id ? 'bg-surface-container-low' : 'hover:bg-surface-container-low/60'
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{c.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">{c.company || c.email || c.type}</p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <AIContextButton type="contact" title={c.name} content={[c.company, c.email, c.type].filter(Boolean).join(' • ')} id={c.id} />
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteContact(c.id) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="hidden xl:block">
          {!selected ? (
            <Panel>
              <EmptyPanel title="Selecteer een contact" description="Klik op een contact links om details, notities, todos en financiën te zien." />
            </Panel>
          ) : detail ? (
            <ContactDetail detail={detail} />
          ) : (
            <Panel>
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#202625] border-t-transparent" />
              </div>
            </Panel>
          )}
        </div>
      </div>

      {showDetail && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 xl:hidden sm:items-center sm:p-4">
          <div className="relative h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface-container-lowest p-6 shadow-xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl">
            <button
              onClick={() => setShowDetail(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low"
            >
              <X size={15} />
            </button>
            {detail ? <ContactDetail detail={detail} /> : (
              <div className="flex items-center justify-center py-16">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#202625] border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  )
}

function ContactDetail({ detail }: { detail: Record<string, unknown> }) {
  const [notesText, setNotesText] = useState(String(detail.notes || ''))
  const [saving, setSaving] = useState(false)

  const todos = (detail.todos as Array<{ id: number; title: string; completed: boolean; priority: string }>) || []
  const notes = (detail.linked_notes as Array<{ id: number; title: string; updated_at: string }>) || []
  const finance = (detail.finance as Array<{ id: number; title: string; type: string; amount: number; status: string }>) || []

  useEffect(() => {
    setNotesText(String(detail.notes || ''))
  }, [detail.id, detail.notes])

  async function saveNotes() {
    setSaving(true)
    await fetch(`/api/contacts/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesText }),
    })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-xl font-extrabold text-white">
            {(detail.name as string).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-on-surface">{detail.name as string}</h2>
            <p className="text-sm text-on-surface-variant">{(detail.company as string) || (detail.type as string)}</p>
          </div>
        </div>

        {(!!detail.email || !!detail.phone) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!!detail.email && (
              <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2">
                <Mail size={12} className="shrink-0 text-on-surface-variant" />
                <span className="text-xs font-medium text-on-surface">{detail.email as string}</span>
              </div>
            )}
            {!!detail.phone && (
              <div className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2">
                <Phone size={12} className="shrink-0 text-on-surface-variant" />
                <span className="text-xs font-medium text-on-surface">{detail.phone as string}</span>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Notities</p>
          <button onClick={saveNotes} disabled={saving} className="text-xs font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-50">
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
        <textarea
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Voeg hier belangrijke details toe..."
          className="mt-3 min-h-[100px] w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low px-3.5 py-3 text-sm leading-6 text-on-surface outline-none placeholder:text-on-surface-variant"
        />
      </Panel>

      {todos.length > 0 && (
        <Panel>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
            Todos ({todos.filter((t) => !t.completed).length} open)
          </p>
          <div>
            {todos.slice(0, 5).map((t, index) => (
              <div key={t.id}>
                {index > 0 && <Divider />}
                <div className="flex items-center gap-2 py-2">
                  <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.completed ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <span className={cn('text-sm', t.completed ? 'text-on-surface-variant line-through' : 'text-on-surface font-medium')}>
                    {t.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {finance.length > 0 && (
        <Panel>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
            Financiën ({finance.length})
          </p>
          <div>
            {finance.slice(0, 5).map((f, index) => (
              <div key={f.id}>
                {index > 0 && <Divider />}
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-on-surface">{f.title}</span>
                  <div className="flex items-center gap-2">
                    <ActionPill>{f.status}</ActionPill>
                    <span className="text-sm font-bold text-on-surface">€{f.amount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {notes.length > 0 && (
        <Panel>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">
            Notes ({notes.length})
          </p>
          <div>
            {notes.slice(0, 3).map((n, index) => (
              <div key={n.id}>
                {index > 0 && <Divider />}
                <p className="py-2 text-sm text-on-surface">{n.title}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
