'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Users, Building2, User, Mail, Phone, Trash2, ChevronRight } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'

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
      fetch(`/api/contacts/${selected}`).then(r => r.json()).then(d => setDetail(d.data))
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
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selected === id) setSelected(null)
  }

  return (
    <div className="flex h-screen">
      {/* Left panel */}
      <div className="flex flex-col w-72 border-r border-white/5 flex-shrink-0">
        {/* Header */}
        <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Contacten</h1>
            <p className="text-xs text-slate-500">{contacts.length} contacten</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="w-7 h-7 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center hover:bg-brand-600/30 transition-colors">
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
            <Search size={12} className="text-slate-600" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken..." className="bg-transparent text-xs text-slate-300 placeholder:text-slate-600 outline-none flex-1" />
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mx-4 mb-2 p-3 bg-[#13151c] border border-white/10 rounded-xl text-xs space-y-2 animate-fade-in">
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Naam *" className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2 py-1.5 outline-none" />
            <div className="flex gap-1.5">
              {(['persoon', 'bedrijf'] as const).map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} className={cn('flex-1 py-1 rounded capitalize', form.type === t ? 'bg-brand-600/20 text-brand-400' : 'bg-white/5 text-slate-500')}>
                  {t}
                </button>
              ))}
            </div>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2 py-1.5 outline-none" />
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Telefoon" className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2 py-1.5 outline-none" />
            <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Bedrijf" className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2 py-1.5 outline-none" />
            <div className="flex gap-1.5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-1.5 rounded bg-white/5 text-slate-500">Annuleer</button>
              <button onClick={saveContact} className="flex-1 py-1.5 rounded bg-brand-600 text-white">Opslaan</button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8"><Users size={24} className="text-slate-700 mx-auto mb-2" /><p className="text-xs text-slate-600">Geen contacten gevonden</p></div>
          ) : contacts.map(c => (
            <div
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer group transition-colors', selected === c.id ? 'bg-brand-600/10' : 'hover:bg-white/5')}
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-semibold', c.type === 'bedrijf' ? 'bg-amber-950/60 text-amber-400' : 'bg-brand-950/60 text-brand-400')}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{c.name}</p>
                <p className="text-[10px] text-slate-600 truncate">{c.company || c.email || c.type}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteContact(c.id) }} className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users size={40} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-600 text-sm">Selecteer een contact</p>
            </div>
          </div>
        ) : detail ? (
          <ContactDetail detail={detail} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

function ContactDetail({ detail }: { detail: Record<string, unknown> }) {
  const todos = (detail.todos as Array<{ id: number; title: string; completed: boolean; priority: string }>) || []
  const notes = (detail.notes as Array<{ id: number; title: string; updated_at: string }>) || []
  const finance = (detail.finance as Array<{ id: number; title: string; type: string; amount: number; status: string }>) || []

  return (
    <div className="p-6 max-w-2xl">
      {/* Contact header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-brand-950/60 text-brand-400 flex items-center justify-center text-2xl font-bold">
          {(detail.name as string).charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">{detail.name as string}</h2>
          <p className="text-sm text-slate-500">{detail.company as string || (detail.type as string)}</p>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {!!detail.email && <InfoField icon={<Mail size={12} />} label="Email" value={detail.email as string} />}
        {!!detail.phone && <InfoField icon={<Phone size={12} />} label="Telefoon" value={detail.phone as string} />}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <Section title={`Todos (${todos.filter(t => !t.completed).length} open)`} empty="Geen todos" count={todos.length}>
          {todos.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-2 py-1.5">
              <div className={cn('w-1.5 h-1.5 rounded-full', t.completed ? 'bg-emerald-500' : 'bg-amber-400')} />
              <span className={cn('text-xs', t.completed ? 'line-through text-slate-600' : 'text-slate-300')}>{t.title}</span>
            </div>
          ))}
        </Section>

        <Section title={`Financiën (${finance.length})`} empty="Geen transacties" count={finance.length}>
          {finance.slice(0, 5).map(f => (
            <div key={f.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-slate-400">{f.title}</span>
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded', f.status === 'betaald' ? 'bg-emerald-950/60 text-emerald-400' : f.status === 'verlopen' ? 'bg-red-950/60 text-red-400' : 'bg-amber-950/60 text-amber-400')}>
                  {f.status}
                </span>
                <span className="text-xs text-slate-400">€{f.amount}</span>
              </div>
            </div>
          ))}
        </Section>

        <Section title={`Notes (${notes.length})`} empty="Geen notes" count={notes.length}>
          {notes.slice(0, 3).map(n => (
            <div key={n.id} className="py-1.5">
              <span className="text-xs text-slate-400">{n.title}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#13151c] rounded-xl p-3 border border-white/5">
      <div className="flex items-center gap-1.5 text-slate-600 mb-1">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="text-sm text-slate-300">{value}</p>
    </div>
  )
}

function Section({ title, empty, children, count }: { title: string; empty: string; children: React.ReactNode; count?: number }) {
  const hasChildren = count !== undefined ? count > 0 : !!children
  return (
    <div className="bg-[#13151c] rounded-xl border border-white/5 p-4">
      <h3 className="text-xs font-semibold text-slate-400 mb-2">{title}</h3>
      {hasChildren ? children : <p className="text-xs text-slate-700">{empty}</p>}
    </div>
  )
}
