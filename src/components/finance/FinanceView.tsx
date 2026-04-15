'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Euro, TrendingUp, TrendingDown, AlertCircle, Trash2, Upload, X, CheckCircle } from 'lucide-react'
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

interface ImportRow {
  date: string
  description: string
  amount: number
  type: 'inkomst' | 'uitgave'
  category: string
}

const FILTERS = ['Alles', 'Facturen', 'Inkomsten', 'Uitgaven']
const STATUSES = ['concept', 'verstuurd', 'betaald', 'verlopen', 'geannuleerd']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function FinanceView() {
  const [items, setItems] = useState<FinanceItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filter, setFilter] = useState('Alles')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ type: 'factuur', title: '', amount: '', due_date: '', category: 'overig' })

  // Bank import state
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportPreview(null)
    setImportResult(null)
    setImportError(null)
    setImportLoading(true)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('import', 'false')

    try {
      const res = await fetch('/api/finance/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Parseren mislukt'); return }
      setImportPreview(data.preview)
    } catch {
      setImportError('Verbindingsfout')
    } finally {
      setImportLoading(false)
    }
  }

  async function doImport() {
    if (!importFile) return
    setImportLoading(true)
    const fd = new FormData()
    fd.append('file', importFile)
    fd.append('import', 'true')

    try {
      const res = await fetch('/api/finance/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Import mislukt'); return }
      setImportResult(data)
      setImportPreview(null)
      fetchData()
    } catch {
      setImportError('Verbindingsfout')
    } finally {
      setImportLoading(false)
    }
  }

  function resetImport() {
    setImportFile(null)
    setImportPreview(null)
    setImportResult(null)
    setImportError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0 gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Financiën</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Facturen, inkomsten &amp; uitgaven</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowImport(s => !s); setShowAdd(false) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500 hover:border-pink-200 hover:text-gray-700 transition-colors"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import</span>
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); setShowImport(false) }}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
            style={{ background: GRAD }}
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Toevoegen</span>
          </button>
        </div>
      </div>

      {/* Bank import panel */}
      {showImport && (
        <div className="mx-4 sm:mx-6 mt-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-blue-800">Bank CSV importeren</p>
              <p className="text-xs text-blue-500 mt-0.5">ING, Rabobank, ABN AMRO of generiek CSV formaat</p>
            </div>
            <button onClick={() => { setShowImport(false); resetImport() }} className="text-blue-400 hover:text-blue-600">
              <X size={16} />
            </button>
          </div>

          {!importResult && (
            <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer hover:border-blue-400 transition-colors bg-white">
              <Upload size={20} className="text-blue-400" />
              <span className="text-sm text-blue-600 font-medium">{importFile ? importFile.name : 'Klik om CSV te kiezen'}</span>
              <span className="text-xs text-gray-400">Exporteer je bankafschrift als CSV</span>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
            </label>
          )}

          {importLoading && (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#3b82f6 transparent #3b82f6 #3b82f6' }} />
              <span className="text-sm text-blue-600">Verwerken...</span>
            </div>
          )}

          {importError && (
            <p className="text-sm text-red-600 mt-2 font-medium">⚠️ {importError}</p>
          )}

          {importResult && (
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle size={16} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium">
                {importResult.imported} van {importResult.total} transacties geïmporteerd!
              </p>
              <button onClick={resetImport} className="text-xs text-blue-500 ml-auto underline">Nog een bestand</button>
            </div>
          )}

          {importPreview && importPreview.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-blue-600 font-semibold mb-2">{importPreview.length} transacties gevonden — preview (eerste 5):</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {importPreview.slice(0, 5).map((row, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 text-xs border border-gray-100">
                    <span className={cn('font-bold w-14 shrink-0', row.type === 'inkomst' ? 'text-emerald-600' : 'text-red-500')}>
                      {row.type === 'inkomst' ? '+' : '-'}€{row.amount.toFixed(2)}
                    </span>
                    <span className="text-gray-600 truncate flex-1">{row.description}</span>
                    <span className="text-gray-400 shrink-0">{row.date}</span>
                  </div>
                ))}
                {importPreview.length > 5 && (
                  <p className="text-xs text-gray-400 text-center py-1">...en {importPreview.length - 5} meer</p>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={doImport}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                  style={{ background: GRAD }}
                >
                  Importeer alle {importPreview.length} transacties
                </button>
                <button onClick={resetImport} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
                  Annuleer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="px-4 sm:px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
          <MiniStat icon={<AlertCircle size={14} />} label="Openstaand" value={formatCurrency(stats.open_amount)} />
          <MiniStat icon={<Euro size={14} />} label="Open facturen" value={String(stats.open_count)} />
          <MiniStat icon={<TrendingUp size={14} />} label="Inkomsten (mnd)" value={formatCurrency(stats.month_income)} positive />
          <MiniStat icon={<TrendingDown size={14} />} label="Uitgaven (mnd)" value={formatCurrency(stats.month_expenses)} negative />
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mx-4 sm:mx-6 mt-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex gap-2 mb-3">
            {(['factuur', 'inkomst', 'uitgave'] as const).map(t => (
              <button
                key={t}
                onClick={() => setForm(p => ({ ...p, type: t }))}
                className={cn('flex-1 py-1.5 rounded-xl text-xs capitalize font-semibold transition-all', form.type === t ? 'text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:text-gray-600')}
                style={form.type === t ? { background: GRAD } : {}}
              >
                {t}
              </button>
            ))}
          </div>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Omschrijving *" className="w-full bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none mb-2 border border-gray-200" style={{ fontSize: '16px' }} />
          <div className="flex gap-2">
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Bedrag (€)" className="flex-1 bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-200" style={{ fontSize: '16px' }} />
            {form.type === 'factuur' && <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="flex-1 bg-white text-gray-600 rounded-xl px-3 py-2 outline-none border border-gray-200" style={{ fontSize: '16px' }} />}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 transition-colors">Annuleer</button>
            <button
              onClick={addItem}
              className="text-sm text-white px-4 py-1.5 rounded-xl font-semibold shadow-sm transition-opacity hover:opacity-90"
              style={{ background: GRAD }}
            >
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-4 sm:px-6 pt-3 pb-2 flex gap-1.5 flex-shrink-0 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap', filter === f ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
            style={filter === f ? { background: GRAD } : {}}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12"><p className="text-gray-400 text-sm">Geen items gevonden.</p></div>
        ) : (
          <div className="space-y-2 pb-4">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 sm:p-3.5 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all group card-hover">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: GRAD }}
                >
                  {item.type === 'factuur' ? <Euro size={14} /> : item.type === 'inkomst' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-700 font-medium truncate">{item.title}</p>
                    {item.invoice_number && <span className="text-[10px] text-gray-400 hidden sm:inline">#{item.invoice_number}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.contact_name && <span className="text-[10px] text-gray-400 hidden sm:inline">{item.contact_name}</span>}
                    {item.due_date && (
                      <span className={cn('text-[10px] font-medium', isOverdue(item.due_date) && item.status !== 'betaald' ? 'text-red-400' : 'text-gray-400')}>
                        {isOverdue(item.due_date) && item.status !== 'betaald' ? '⚠ ' : ''}{formatDate(item.due_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-gradient">{formatCurrency(item.amount)}</span>
                  <select
                    value={item.status}
                    onChange={e => updateStatus(item.id, e.target.value)}
                    className={cn('text-[10px] px-1.5 sm:px-2 py-1 rounded-lg border-0 outline-none cursor-pointer font-medium', STATUS_COLORS[item.status] || 'text-gray-400 bg-gray-100')}
                    style={{ fontSize: '12px' }}
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
    <div className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 shadow-sm card-hover">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn('flex-shrink-0', positive ? 'text-emerald-500' : negative ? 'text-red-400' : 'icon-gradient')}>{icon}</span>
        <span className="text-[10px] text-gray-400 font-medium truncate">{label}</span>
      </div>
      <p className="text-sm sm:text-base font-extrabold text-gradient">{value}</p>
    </div>
  )
}
