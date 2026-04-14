'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Users, Mail, Phone, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

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
    <div className="flex min-h-full flex-col bg-white lg:flex-row">
      {/* Left panel */}
      <div className="flex w-full flex-col border-b border-gray-100 bg-white lg:w-72 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        {/* Header */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-gradient">Contacten</h1>
            <p className="text-xs text-gray-400 font-medium">{contacts.length} contacten</p>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: GRAD }}
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
            <Search size={12} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken..." className="bg-transparent text-xs text-gray-700 placeholder:text-gray-400 outline-none flex-1" />
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mx-4 mb-2 p-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-2 animate-fade-in">
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Naam *" className="w-full bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-2 py-1.5 outline-none border border-gray-200" />
            <div className="flex gap-1.5">
              {(['persoon', 'bedrijf'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={cn('flex-1 py-1 rounded-lg capitalize font-medium transition-all', form.type === t ? 'text-white' : 'bg-white text-gray-400 border border-gray-200')}
                  style={form.type === t ? { background: GRAD } : {}}
                >
                  {t}
                </button>
              ))}
            </div>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-2 py-1.5 outline-none border border-gray-200" />
            <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Telefoon" className="w-full bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-2 py-1.5 outline-none border border-gray-200" />
            <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Bedrijf" className="w-full bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-2 py-1.5 outline-none border border-gray-200" />
            <div className="flex gap-1.5">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-1.5 rounded-xl bg-gray-100 text-gray-500 font-medium">Annuleer</button>
              <button onClick={saveContact} className="flex-1 py-1.5 rounded-xl text-white font-medium" style={{ background: GRAD }}>Opslaan</button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8">
              <Users size={24} className="text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Geen contacten gevonden</p>
            </div>
          ) : contacts.map(c => (
            <div
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer group transition-all', selected === c.id ? 'bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50' : 'hover:bg-gray-50')}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: GRAD }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold truncate', selected === c.id ? 'text-gradient' : 'text-gray-700')}>{c.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{c.company || c.email || c.type}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteContact(c.id) }} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="min-h-[40vh] flex-1 overflow-y-auto bg-white">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">Selecteer een contact</p>
            </div>
          </div>
        ) : detail ? (
          <ContactDetail detail={detail} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
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
  const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

  return (
    <div className="max-w-2xl p-5 sm:p-8">
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-extrabold text-white shadow-md" style={{ background: GRAD }}>
          {(detail.name as string).charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-gradient">{detail.name as string}</h2>
          <p className="text-sm text-gray-400 font-medium">{detail.company as string || (detail.type as string)}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!!detail.email && <InfoField icon={<Mail size={12} />} label="Email" value={detail.email as string} />}
        {!!detail.phone && <InfoField icon={<Phone size={12} />} label="Telefoon" value={detail.phone as string} />}
      </div>

      <div className="space-y-4">
        <Section title={`Todos (${todos.filter(t => !t.completed).length} open)`} empty="Geen todos" count={todos.length}>
          {todos.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-2 py-1.5">
              <div className={cn('w-1.5 h-1.5 rounded-full', t.completed ? 'bg-emerald-400' : 'bg-amber-400')} />
              <span className={cn('text-xs font-medium', t.completed ? 'line-through text-gray-400' : 'text-gray-600')}>{t.title}</span>
            </div>
          ))}
        </Section>

        <Section title={`Financiën (${finance.length})`} empty="Geen transacties" count={finance.length}>
          {finance.slice(0, 5).map(f => (
            <div key={f.id} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-gray-500 font-medium">{f.title}</span>
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', f.status === 'betaald' ? 'bg-emerald-50 text-emerald-600' : f.status === 'verlopen' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600')}>
                  {f.status}
                </span>
                <span className="text-xs font-bold text-gradient">€{f.amount}</span>
              </div>
            </div>
          ))}
        </Section>

        <Section title={`Notes (${notes.length})`} empty="Geen notes" count={notes.length}>
          {notes.slice(0, 3).map(n => (
            <div key={n.id} className="py-1.5">
              <span className="text-xs text-gray-500 font-medium">{n.title}</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-1.5 text-gray-400 mb-1">{icon}<span className="text-[10px] uppercase tracking-wider font-medium">{label}</span></div>
      <p className="text-sm text-gray-700 font-semibold">{value}</p>
    </div>
  )
}

function Section({ title, empty, children, count }: { title: string; empty: string; children: React.ReactNode; count?: number }) {
  const hasChildren = count !== undefined ? count > 0 : !!children
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <h3 className="text-xs font-bold text-gradient mb-3">{title}</h3>
      {hasChildren ? children : <p className="text-xs text-gray-400">{empty}</p>}
    </div>
  )
}
