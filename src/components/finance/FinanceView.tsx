'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Euro, TrendingUp, TrendingDown, AlertCircle, Trash2 } from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue, STATUS_COLORS } from '@/lib/utils'

interface FinanceItem {
  id: number
  type: 'factuur' | 'inkomst' | 'uitgave'
  title: string
  amount: number
  contact_name?: string
  status: string
  invoice_number?: string
  due_date?: string
  category: string
  created_at: string
}

interface Stats {
  open_amount: number
  open_count: number
  month_income: number
  month_expenses: number
}

const FILTERS = ['Alles', 'Facturen', 'Inkomsten', 'Uitgaven']
const STATUSES = ['concept', 'verstuurd', 'betaald', 'verlopen', 'geannuleerd']

export default function FinanceView() {
  const [items, setItems] = useState<FinanceItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState('Alles')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ type: 'factuur', title: '', amount: '', due_date: '', category: 'overig' })

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams()
    if (filter === 'Facturen') params.set('type', 'factuur')
    else if (filter === 'Inkomsten') params.set('type', 'inkomst')
    else if (filter === 'Uitgaven') params.set('type', 'uitgave')

    const res = await fetch(`/api/finance?${params}`)
    const data = await res.json()
    setItems(data.data || [])
    setStats(data.stats)
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  async function addItem() {
    if (!form.title.trim()) return
    await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0 }),
    })
    setForm({ type: 'factuur', title: '', amount: '', due_date: '', category: 'overig' })
    setShowAdd(false)
    fetchData()
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/finance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchData()
  }

  async function deleteItem(id: number) {
    await fetch(`/api/finance/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Financiën</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Facturen, inkomsten &amp; uitgaven</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
        >
          <Plus size={14} />
          Toevoegen
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
          <MiniStat icon={<AlertCircle size={14} />} label="Openstaand" value={formatCurrency(stats.open_amount)} />
          <MiniStat icon={<Euro size={14} />} label="Open facturen" value={String(stats.open_count)} />
          <MiniStat icon={<TrendingUp size={14} />} label="Inkomsten (mnd)" value={formatCurrency(stats.month_income)} positive />
          <MiniStat icon={<TrendingDown size={14} />} label="Uitgaven (mnd)" value={formatCurrency(stats.month_expenses)} negative />
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mx-6 mt-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex gap-2 mb-3">
            {(['factuur', 'inkomst', 'uitgave'] as const).map(t => (
              <button
                key={t}
                onClick={() => setForm(p => ({ ...p, type: t }))}
                className={cn('flex-1 py-1.5 rounded-xl text-xs capitalize font-semibold transition-all', form.type === t ? 'text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:text-gray-600')}
                style={form.type === t ? { background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' } : {}}
              >
                {t}
              </button>
            ))}
          </div>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Omschrijving *" className="w-full bg-white text-sm text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none mb-2 border border-gray-200" />
          <div className="flex gap-2">
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Bedrag (€)" className="flex-1 bg-white text-xs text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-200" />
            {form.type === 'factuur' && <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="flex-1 bg-white text-xs text-gray-600 rounded-xl px-3 py-2 outline-none border border-gray-200" />}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 transition-colors">Annuleer</button>
            <button
              onClick={addItem}
              className="text-xs text-white px-4 py-1.5 rounded-xl font-semibold shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
            >
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 pt-3 pb-2 flex gap-1.5 flex-shrink-0">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all', filter === f ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
            style={filter === f ? { background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' } : {}}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-400 text-sm">Geen items gevonden.</p></div>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all group card-hover">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
                >
                  {item.type === 'factuur' ? <Euro size={14} /> : item.type === 'inkomst' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-700 font-medium truncate">{item.title}</p>
                    {item.invoice_number && <span className="text-[10px] text-gray-400">#{item.invoice_number}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.contact_name && <span className="text-[10px] text-gray-400">{item.contact_name}</span>}
                    {item.due_date && (
                      <span className={cn('text-[10px] font-medium', isOverdue(item.due_date) && item.status !== 'betaald' ? 'text-red-400' : 'text-gray-400')}>
                        {isOverdue(item.due_date) && item.status !== 'betaald' ? '⚠ ' : ''}{formatDate(item.due_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-gradient">{formatCurrency(item.amount)}</span>
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    className={cn('text-[10px] px-2 py-1 rounded-lg border-0 outline-none cursor-pointer font-medium', STATUS_COLORS[item.status] || 'text-gray-400 bg-gray-100')}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value, positive, negative }: { icon: React.ReactNode; label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm card-hover">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn('flex-shrink-0', positive ? 'text-emerald-500' : negative ? 'text-red-400' : 'icon-gradient')}>{icon}</span>
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      </div>
      <p className="text-base font-extrabold text-gradient">{value}</p>
    </div>
  )
}
