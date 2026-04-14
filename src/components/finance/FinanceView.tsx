'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Euro, TrendingUp, TrendingDown, AlertCircle, Check, Trash2 } from 'lucide-react'
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Financiën</h1>
          <p className="text-xs text-slate-500 mt-0.5">Facturen, inkomsten & uitgaven</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 transition-colors">
          <Plus size={14} />
          Toevoegen
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
          <MiniStat icon={<AlertCircle size={14} />} label="Openstaand" value={formatCurrency(stats.open_amount)} color="text-amber-400" />
          <MiniStat icon={<Euro size={14} />} label="Open facturen" value={String(stats.open_count)} color="text-amber-400" />
          <MiniStat icon={<TrendingUp size={14} />} label="Inkomsten (mnd)" value={formatCurrency(stats.month_income)} color="text-emerald-400" />
          <MiniStat icon={<TrendingDown size={14} />} label="Uitgaven (mnd)" value={formatCurrency(stats.month_expenses)} color="text-red-400" />
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mx-6 mt-2 p-4 bg-[#13151c] border border-white/10 rounded-xl animate-fade-in">
          <div className="flex gap-2 mb-3">
            {(['factuur', 'inkomst', 'uitgave'] as const).map(t => (
              <button key={t} onClick={() => setForm(p => ({ ...p, type: t }))} className={cn('flex-1 py-1.5 rounded-lg text-xs capitalize', form.type === t ? 'bg-brand-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300')}>
                {t}
              </button>
            ))}
          </div>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Omschrijving *" className="w-full bg-white/5 text-sm text-slate-300 placeholder:text-slate-600 rounded-lg px-3 py-2 outline-none mb-2" />
          <div className="flex gap-2">
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Bedrag (€)" className="flex-1 bg-white/5 text-xs text-slate-300 placeholder:text-slate-600 rounded-lg px-3 py-2 outline-none" />
            {form.type === 'factuur' && <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="flex-1 bg-white/5 text-xs text-slate-300 rounded-lg px-3 py-2 outline-none" />}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5">Annuleer</button>
            <button onClick={addItem} className="text-xs bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-500 transition-colors">Opslaan</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 pt-3 pb-2 flex gap-1.5 flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1 rounded-full text-xs transition-colors', filter === f ? 'bg-brand-600/20 text-brand-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5')}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12"><p className="text-slate-600 text-sm">Geen items gevonden.</p></div>
        ) : (
          <div className="space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-[#13151c] border border-white/5 rounded-xl hover:border-white/10 transition-colors group">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  item.type === 'factuur' ? 'bg-amber-950/60' : item.type === 'inkomst' ? 'bg-emerald-950/60' : 'bg-red-950/60'
                )}>
                  {item.type === 'factuur' ? <Euro size={14} className="text-amber-400" /> : item.type === 'inkomst' ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-200 truncate">{item.title}</p>
                    {item.invoice_number && <span className="text-[10px] text-slate-600">#{item.invoice_number}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.contact_name && <span className="text-[10px] text-slate-600">{item.contact_name}</span>}
                    {item.due_date && (
                      <span className={cn('text-[10px]', isOverdue(item.due_date) && item.status !== 'betaald' ? 'text-red-400' : 'text-slate-600')}>
                        {isOverdue(item.due_date) && item.status !== 'betaald' ? '⚠ ' : ''}{formatDate(item.due_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium text-white">{formatCurrency(item.amount)}</span>
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    className={cn('text-[10px] px-2 py-1 rounded-lg border-0 outline-none cursor-pointer', STATUS_COLORS[item.status] || 'text-slate-400 bg-slate-800')}
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all">
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

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-[#13151c] border border-white/5 rounded-xl p-3">
      <div className={cn('flex items-center gap-1.5 mb-1', color)}>{icon}<span className="text-[10px] text-slate-500">{label}</span></div>
      <p className="text-base font-semibold text-white">{value}</p>
    </div>
  )
}
