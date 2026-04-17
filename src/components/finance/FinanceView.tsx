'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Plus, TrendingUp, TrendingDown, Trash2, Upload, X, CheckCircle, Sparkles, BarChart2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Repeat, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks, addMonths, format, startOfDay, endOfDay } from 'date-fns'
import { nl } from 'date-fns/locale'

interface FinanceItem {
  id: number
  type: 'inkomst' | 'uitgave'
  title: string
  amount: number
  contact_name?: string
  status: string
  due_date?: string
  category: string
  account: string
  created_at: string
  user_notes?: string
}

interface Stats {
  open_amount: number
  open_count: number
  month_income: number
  month_expenses: number
  active_month: string | null
}

interface CategoryStat {
  category: string
  total: number
  count: number
}

interface MonthlyPoint {
  month: string
  income: number
  expenses: number
}

interface ImportRow {
  date: string
  description: string
  amount: number
  type: 'inkomst' | 'uitgave'
  category: string
  is_duplicate?: boolean
}

interface AnalyseResult {
  recurringGroups: Array<{
    merchantKey: string
    displayName: string
    merchantType: string
    category: string
    subcategory: string
    recurrenceType: string
    recurrenceLabel: string
    recurrenceConfidence: number
    confidenceLabel: 'high' | 'medium' | 'low'
    frequency: string
    amountPerCharge: number
    monthlyEquivalent: number | null
    monthlyEquivalentLabel: string | null
    count: number
    lastSeen: string
    intervalDaysMedian: number | null
    explanation: string
    needsReview: boolean
    userVerified: boolean
    fixedCost: boolean
    essential: boolean
    reviewReason?: string
  }>
  patterns: Array<{ merchant: string; totalSpent: number; visits: number; avgAmount: number; category: string; confidenceLabel: 'high' | 'medium' | 'low' }>
  trends: Array<{ month: string; income: number; expenses: number; net: number; topCategory: string }>
  anomalies: Array<{ id?: number; title: string; amount: number; date: string; reason: string; severity: 'low' | 'medium' | 'high' }>
  reviewQuestions: Array<{
    queueKey: string
    merchantKey: string
    merchantLabel: string
    prompt: string
    rationale: string
    priority: number
    confidenceLabel: 'high' | 'medium' | 'low'
    suggestedActions: Array<{
      label: string
      rulePatch: Record<string, unknown>
    }>
  }>
  summary: {
    totalIncome: number
    totalExpenses: number
    net: number
    recurringMonthlyCost: number
    fixedMonthlyCost: number
    subscriptionMonthlyCost: number
    uncertainRecurringCount: number
    transactionCount: number
  }
  aiInsights: string
}

const TYPE_FILTERS = ['Alles', 'Inkomsten', 'Uitgaven']
const ACCOUNT_FILTERS = ['Alle rekeningen', 'Privé', 'Zakelijk']
const ACCOUNTS = ['privé', 'zakelijk']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

const CATEGORY_COLORS: Record<string, string> = {
  boodschappen: 'bg-emerald-400',
  auto: 'bg-blue-400',
  transport: 'bg-sky-400',
  eten: 'bg-amber-400',
  abonnement: 'bg-violet-400',
  belasting: 'bg-red-400',
  'vaste lasten': 'bg-orange-400',
  kleding: 'bg-pink-400',
  overig: 'bg-gray-300',
}

const CONFIDENCE_STYLE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  medium: 'bg-amber-50 text-amber-600 border-amber-100',
  low: 'bg-red-50 text-red-600 border-red-100',
}

function confidenceText(level: 'high' | 'medium' | 'low') {
  if (level === 'high') return 'zeker'
  if (level === 'medium') return 'waarschijnlijk'
  return 'twijfel'
}

export default function FinanceView() {
  const [items, setItems] = useState<FinanceItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([])
  const [typeFilter, setTypeFilter] = useState('Alles')
  const [accountFilter, setAccountFilter] = useState('Alle rekeningen')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [form, setForm] = useState({ type: 'uitgave' as 'inkomst' | 'uitgave', title: '', amount: '', due_date: '', category: 'overig', account: 'privé' })

  const dateRange = useMemo(() => {
    let start, end
    if (viewMode === 'day') {
      start = startOfDay(currentDate)
      end = endOfDay(currentDate)
    } else if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 })
      end = endOfWeek(currentDate, { weekStartsOn: 1 })
    } else {
      start = startOfMonth(currentDate)
      end = endOfMonth(currentDate)
    }
    return { start, end }
  }, [viewMode, currentDate])

  const navigate = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -1 : 1
    if (viewMode === 'day') setCurrentDate(prev => addDays(prev, amount))
    else if (viewMode === 'week') setCurrentDate(prev => addWeeks(prev, amount))
    else setCurrentDate(prev => addMonths(prev, amount))
  }

  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [showAnalyse, setShowAnalyse] = useState(false)
  const [analyseResult, setAnalyseResult] = useState<AnalyseResult | null>(null)
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [applyingRuleKey, setApplyingRuleKey] = useState<string | null>(null)

  // Bank import state
  const [showImport, setShowImport] = useState(false)
  const [importMethod, setImportMethod] = useState<'csv' | 'ai'>('csv')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importText, setImportText] = useState('')
  const [importAccount, setImportAccount] = useState('privé')
  const [importPreview, setImportPreview] = useState<(ImportRow & { is_duplicate?: boolean })[] | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams()
    if (typeFilter === 'Inkomsten') params.set('type', 'inkomst')
    else if (typeFilter === 'Uitgaven') params.set('type', 'uitgave')
    if (accountFilter === 'Privé') params.set('account', 'privé')
    else if (accountFilter === 'Zakelijk') params.set('account', 'zakelijk')

    params.set('from', format(dateRange.start, 'yyyy-MM-dd'))
    params.set('to', format(dateRange.end, 'yyyy-MM-dd'))

    const [financeRes, catRes] = await Promise.all([
      fetch(`/api/finance?${params}`).then(r => r.json()),
      fetch(`/api/finance/stats?from=${format(dateRange.start, 'yyyy-MM-dd')}&to=${format(dateRange.end, 'yyyy-MM-dd')}`).then(r => r.json()).catch(() => ({ categories: [], monthly: [] })),
    ])

    const filtered = (financeRes.data || []).filter((i: FinanceItem) => i.type !== 'factuur' as string)
    setItems(filtered)
    setStats(financeRes.stats)
    setCategoryStats(catRes.categories || [])
    setMonthlyData(catRes.monthly || [])
    setLoading(false)
  }, [typeFilter, accountFilter, dateRange.start, dateRange.end])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    setAiLoading(true)
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'finance' }),
    })
      .then(r => r.json())
      .then(d => setAiSummary(d.summary ?? null))
      .catch(() => {})
      .finally(() => setAiLoading(false))
  }, [])

  async function addItem() {
    if (!form.title.trim()) return
    await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0 }),
    })
    setForm({ type: 'uitgave', title: '', amount: '', due_date: '', category: 'overig', account: 'privé' })
    setShowAdd(false)
    fetchData()
  }

  async function deleteItem(id: number) {
    await fetch(`/api/finance/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function bulkDelete(type?: string, account?: string) {
    setBulkDeleteLoading(true)
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (account) params.set('account', account)
    await fetch(`/api/finance?${params}`, { method: 'DELETE' })
    setShowBulkDelete(false)
    setBulkDeleteLoading(false)
    fetchData()
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
    fd.append('account', importAccount)

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

  async function handleAiParse() {
    if (!importText.trim()) return
    setImportLoading(true)
    setImportError(null)
    setImportPreview(null)
    setImportResult(null)

    try {
      const res = await fetch('/api/finance/import/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText, account: importAccount })
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'AI Parseren mislukt'); return }
      setImportPreview(data.preview)
    } catch {
      setImportError('Verbindingsfout')
    } finally {
      setImportLoading(false)
    }
  }

  async function doImport() {
    if (importMethod === 'csv' && !importFile) return
    if (importMethod === 'ai' && !importPreview) return
    
    setImportLoading(true)
    try {
      let res;
      if (importMethod === 'csv') {
        const fd = new FormData()
        fd.append('file', importFile!)
        fd.append('import', 'true')
        fd.append('account', importAccount)
        res = await fetch('/api/finance/import', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/finance/import/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: importPreview, account: importAccount })
        })
      }
      
      const data = await res.json()
      if (!res.ok) { setImportError(data.error ?? 'Import mislukt'); return }
      setImportResult(data)
      setImportPreview(null)
      setImportText('')
      fetchData()
    } catch {
      setImportError('Verbindingsfout')
    } finally {
      setImportLoading(false)
    }
  }

  async function runAnalyse() {
    setAnalyseLoading(true)
    setAnalyseError(null)
    try {
      const res = await fetch('/api/finance/analyse', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setAnalyseError(data.error ?? 'Analyse mislukt'); return }
      setAnalyseResult(data)
      setShowAnalyse(true)
    } catch {
      setAnalyseError('Verbindingsfout')
    } finally {
      setAnalyseLoading(false)
    }
  }

  async function applyFinanceRule(questionKey: string, rulePatch: Record<string, unknown>) {
    setApplyingRuleKey(questionKey)
    setAnalyseError(null)
    try {
      const res = await fetch('/api/finance/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rulePatch),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnalyseError(data.error ?? 'Opslaan van merchantregel mislukt')
        return
      }
      await runAnalyse()
    } catch {
      setAnalyseError('Verbindingsfout bij opslaan van merchantregel')
    } finally {
      setApplyingRuleKey(null)
    }
  }

  async function updateTransaction(id: number, data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/finance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Update mislukt')
      await runAnalyse()
      fetchData()
    } catch (err) {
      setAnalyseError('Fout bij bijwerken transactie')
    }
  }

  function resetImport() {
    setImportFile(null)
    setImportText('')
    setImportPreview(null)
    setImportResult(null)
    setImportError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const net = (stats?.month_income || 0) - (stats?.month_expenses || 0)
  const maxMonthly = monthlyData.reduce((m, d) => Math.max(m, d.income, d.expenses), 1)

  // Format active_month (e.g. "2024-12") to readable label like "dec. 2024"
  const activePeriod = viewMode === 'month'
    ? (format(currentDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM') ? 'deze maand' : format(currentDate, 'MMM yyyy', { locale: nl }))
    : viewMode === 'week' ? 'deze week' : 'vandaag'

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="px-4 sm:px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0 gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Financiën</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">Inkomsten &amp; uitgaven</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAnalyse}
            disabled={analyseLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: GRAD }}
            title="AI Analyse"
          >
            {analyseLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span className="hidden sm:inline">{analyseLoading ? 'Analyseren...' : 'Analyseer'}</span>
          </button>
          <button
            onClick={() => setShowBulkDelete(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400 transition-colors"
            title="Alles verwijderen"
          >
            <Trash2 size={14} />
          </button>
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

      {/* Date Navigation */}
      <div className="px-4 sm:px-6 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200">
          {(['day', 'week', 'month'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all',
                viewMode === mode ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-600'
              )}
              style={viewMode === mode ? { background: GRAD } : {}}
            >
              {mode === 'day' ? 'Dag' : mode === 'week' ? 'Week' : 'Maand'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => navigate('prev')} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-bold text-gray-700 min-w-[120px] text-center capitalize">
            {viewMode === 'day' && format(currentDate, 'd MMMM yyyy', { locale: nl })}
            {viewMode === 'week' && `${format(dateRange.start, 'd MMM')} - ${format(dateRange.end, 'd MMM')}`}
            {viewMode === 'month' && format(currentDate, 'MMMM yyyy', { locale: nl })}
          </span>
          <button onClick={() => navigate('next')} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-[10px] font-bold text-pink-500 hover:text-pink-600 uppercase tracking-wider ml-1 hidden sm:inline"
          >
            Vandaag
          </button>
        </div>
      </div>

      {/* Bulk delete modal */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Transacties verwijderen</p>
                <p className="text-xs text-gray-400">Kies wat je wilt wissen</p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              <button onClick={() => bulkDelete('uitgave', 'privé')} disabled={bulkDeleteLoading} className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-left hover:bg-red-50 hover:border-red-200 transition-colors">
                🏠 Alle privé uitgaven
              </button>
              <button onClick={() => bulkDelete('uitgave', 'zakelijk')} disabled={bulkDeleteLoading} className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-left hover:bg-red-50 hover:border-red-200 transition-colors">
                💼 Alle zakelijke uitgaven
              </button>
              <button onClick={() => bulkDelete('inkomst', 'privé')} disabled={bulkDeleteLoading} className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-left hover:bg-red-50 hover:border-red-200 transition-colors">
                🏠 Alle privé inkomsten
              </button>
              <button onClick={() => bulkDelete('inkomst', 'zakelijk')} disabled={bulkDeleteLoading} className="w-full py-2.5 px-4 rounded-xl border border-gray-200 text-sm text-left hover:bg-red-50 hover:border-red-200 transition-colors">
                💼 Alle zakelijke inkomsten
              </button>
              <button onClick={() => bulkDelete()} disabled={bulkDeleteLoading} className="w-full py-2.5 px-4 rounded-xl border border-red-200 bg-red-50 text-sm text-left text-red-600 font-semibold hover:bg-red-100 transition-colors">
                ⚠️ Alles verwijderen
              </button>
            </div>
            <button onClick={() => setShowBulkDelete(false)} className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              Annuleer
            </button>
          </div>
        </div>
      )}

      {/* Analyse error */}
      {analyseError && (
        <div className="mx-4 sm:mx-6 mt-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
          ⚠️ {analyseError}
        </div>
      )}

      {analyseResult && (
        <FinanceAnalysisPanel
          analyseResult={analyseResult}
          showAnalyse={showAnalyse}
          setShowAnalyse={setShowAnalyse}
          applyingRuleKey={applyingRuleKey}
          onApplyRule={applyFinanceRule}
          onUpdateTransaction={updateTransaction}
        />
      )}

      {/* AI Summary */}
      {(aiSummary || aiLoading) && (
        <div className="mx-4 sm:mx-6 mt-3 px-4 py-3 bg-gradient-to-r from-orange-50 to-pink-50 border border-pink-100 rounded-2xl flex items-start gap-2.5">
          <Sparkles size={14} className="text-pink-400 flex-shrink-0 mt-0.5" />
          {aiLoading ? (
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-pink-300 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed">{aiSummary}</p>
          )}
        </div>
      )}

      {/* Bank import panel */}
      {showImport && (
        <div className="mx-4 sm:mx-6 mt-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold text-blue-800">Transacties importeren</p>
              <p className="text-xs text-blue-500 mt-0.5">Upload CSV of plak ruwe banktekst (AI)</p>
            </div>
            <button onClick={() => { setShowImport(false); resetImport() }} className="text-blue-400 hover:text-blue-600">
              <X size={16} />
            </button>
          </div>

          {/* Method selector */}
          <div className="flex gap-2 mb-3">
            {(['csv', 'ai'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setImportMethod(m); resetImport() }}
                className={cn('flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all border', importMethod === m ? 'bg-blue-600 text-white border-transparent shadow-sm' : 'bg-white text-gray-400 border-gray-200')}
              >
                {m === 'csv' ? 'CSV Bestand' : 'Plak Tekst (AI)'}
              </button>
            ))}
          </div>

          {/* Account selector */}
          <div className="flex gap-2 mb-3">
            {ACCOUNTS.map(acc => (
              <button
                key={acc}
                onClick={() => setImportAccount(acc)}
                className={cn('flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all border', importAccount === acc ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-400 border-gray-200')}
                style={importAccount === acc ? { background: GRAD } : {}}
              >
                {acc === 'privé' ? '🏠 Privé' : '💼 Zakelijk'}
              </button>
            ))}
          </div>

          {!importResult && !importPreview && (
            <>
              {importMethod === 'csv' ? (
                <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-blue-200 rounded-xl cursor-pointer hover:border-blue-400 transition-colors bg-white">
                  <Upload size={20} className="text-blue-400" />
                  <span className="text-sm text-blue-600 font-medium">{importFile ? importFile.name : 'Klik om CSV te kiezen'}</span>
                  <span className="text-xs text-gray-400">Exporteer je bankafschrift als CSV</span>
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
                </label>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Plak hier de tekst uit je (Rabobank) PDF export..."
                    className="w-full h-32 p-3 text-xs border border-blue-200 rounded-xl outline-none focus:border-blue-400 transition-colors bg-white"
                  />
                  <button
                    onClick={handleAiParse}
                    disabled={importLoading || !importText.trim()}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: GRAD }}
                  >
                    {importLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Parseren met AI
                  </button>
                </div>
              )}
            </>
          )}

          {importLoading && (importMethod === 'csv' || !importPreview) && (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#3b82f6 transparent #3b82f6 #3b82f6' }} />
              <span className="text-sm text-blue-600">Verwerken...</span>
            </div>
          )}
          {importError && <p className="text-sm text-red-600 mt-2 font-medium">⚠️ {importError}</p>}
          {importResult && (
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle size={16} className="text-emerald-500" />
              <p className="text-sm text-emerald-700 font-medium">{importResult.imported} van {importResult.total} transacties geïmporteerd als <strong>{importAccount}</strong>!</p>
              <button onClick={resetImport} className="text-xs text-blue-500 ml-auto underline">Nog een bestand</button>
            </div>
          )}
          {importPreview && importPreview.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-blue-600 font-semibold mb-2">{importPreview.length} transacties gevonden ({importAccount}) — controleer op duplicaten:</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {importPreview.map((row, i) => (
                  <div key={i} className={cn('flex items-center gap-2 rounded-xl px-3 py-2 text-xs border', row.is_duplicate ? 'bg-amber-50 border-amber-100 opacity-75' : 'bg-white border-gray-100')}>
                    <span className={cn('font-bold w-14 shrink-0', row.type === 'inkomst' ? 'text-emerald-600' : 'text-red-500')}>
                      {row.type === 'inkomst' ? '+' : '-'}€{row.amount.toFixed(2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-600 truncate font-medium">{row.description}</p>
                      {row.is_duplicate && <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">Mogelijk duplicaat</p>}
                    </div>
                    <span className="text-gray-400 shrink-0">{row.date}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={doImport} className="flex-1 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity" style={{ background: GRAD }}>
                  Importeer {importPreview.filter(p => !p.is_duplicate).length} nieuwe transacties
                </button>
                <button onClick={resetImport} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-colors">Annuleer</button>
              </div>
              {importPreview.some(p => p.is_duplicate) && (
                <p className="text-[10px] text-amber-600 mt-2 text-center">
                  <strong>Let op:</strong> Transacties die gemarkeerd zijn als &quot;Mogelijk duplicaat&quot; worden overgeslagen.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="px-4 sm:px-6 pt-4 pb-2 grid grid-cols-3 gap-3 flex-shrink-0">
          <MiniStat icon={<TrendingUp size={14} />} label={`Inkomsten (${activePeriod})`} value={formatCurrency(stats.month_income)} positive />
          <MiniStat icon={<TrendingDown size={14} />} label={`Uitgaven (${activePeriod})`} value={formatCurrency(stats.month_expenses)} negative />
          <MiniStat
            icon={net >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            label={`Netto (${activePeriod})`}
            value={formatCurrency(Math.abs(net))}
            positive={net >= 0}
            negative={net < 0}
            prefix={net >= 0 ? '+' : '-'}
          />
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mx-4 sm:mx-6 mt-2 p-4 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm">
          <div className="flex gap-2 mb-3">
            {(['inkomst', 'uitgave'] as const).map(t => (
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
          <div className="flex gap-2 mb-2">
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Bedrag (€)" className="flex-1 bg-white text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-200" style={{ fontSize: '16px' }} />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="flex-1 bg-white text-gray-600 rounded-xl px-3 py-2 outline-none border border-gray-200" style={{ fontSize: '16px' }}>
              {['overig','boodschappen','auto','transport','eten','abonnement','belasting','vaste lasten','kleding'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 mb-3">
            {ACCOUNTS.map(acc => (
              <button
                key={acc}
                onClick={() => setForm(p => ({ ...p, account: acc }))}
                className={cn('flex-1 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all border', form.account === acc ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-400 border-gray-200')}
                style={form.account === acc ? { background: GRAD } : {}}
              >
                {acc === 'privé' ? '🏠 Privé' : '💼 Zakelijk'}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 transition-colors">Annuleer</button>
            <button onClick={addItem} className="text-sm text-white px-4 py-1.5 rounded-xl font-semibold shadow-sm transition-opacity hover:opacity-90" style={{ background: GRAD }}>Opslaan</button>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="px-4 sm:px-6 pt-3 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {monthlyData.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={13} className="text-gray-400" />
              <p className="text-xs font-bold text-gray-500">Maandoverzicht</p>
            </div>
            <div className="flex items-end gap-1.5 h-20">
              {monthlyData.slice(-6).map((d, i) => {
                const incPct = Math.round((d.income / maxMonthly) * 100)
                const expPct = Math.round((d.expenses / maxMonthly) * 100)
                return (
                  <div key={i} className="flex-1 flex gap-0.5 items-end h-full">
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="rounded-t-sm" style={{ height: `${incPct}%`, background: '#10b981', minHeight: incPct > 0 ? 2 : 0 }} title={`Inkomsten: ${formatCurrency(d.income)}`} />
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                      <div className="rounded-t-sm bg-red-400" style={{ height: `${expPct}%`, minHeight: expPct > 0 ? 2 : 0 }} title={`Uitgaven: ${formatCurrency(d.expenses)}`} />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Inkomsten</span>
              <span className="flex items-center gap-1 text-[10px] text-gray-400"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Uitgaven</span>
            </div>
          </div>
        )}
        {categoryStats.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={13} className="text-gray-400" />
              <p className="text-xs font-bold text-gray-500">Uitgaven per categorie</p>
            </div>
            <div className="space-y-2">
              {categoryStats.slice(0, 5).map(cat => {
                const maxCat = categoryStats[0]?.total || 1
                const pct = Math.round((cat.total / maxCat) * 100)
                const colorClass = CATEGORY_COLORS[cat.category] || 'bg-gray-300'
                return (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-20 truncate capitalize">{cat.category}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 w-14 text-right">{formatCurrency(cat.total)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-6 pt-2 pb-1 flex flex-wrap gap-1.5 flex-shrink-0">
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap', typeFilter === f ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100')}
              style={typeFilter === f ? { background: GRAD } : {}}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {ACCOUNT_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setAccountFilter(f)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border', accountFilter === f ? 'text-white shadow-sm border-transparent' : 'text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-100')}
              style={accountFilter === f ? { background: GRAD } : {}}
            >
              {f === 'Privé' ? '🏠 Privé' : f === 'Zakelijk' ? '💼 Zakelijk' : f}
            </button>
          ))}
        </div>
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
              <div key={item.id} className="flex items-center gap-3 p-3 sm:p-3.5 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all group">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: GRAD }}
                >
                  {item.type === 'inkomst' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium truncate">{item.title}</p>
                  {item.user_notes && (
                    <p className="text-[10px] text-pink-600 font-medium mt-0.5 italic flex items-center gap-1">
                      <Sparkles size={10} /> {item.user_notes}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400 capitalize">{item.category}</span>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', item.account === 'zakelijk' ? 'bg-blue-50 text-blue-500' : 'bg-gray-100 text-gray-400')}>
                      {item.account === 'zakelijk' ? '💼' : '🏠'} {item.account}
                    </span>
                    {item.due_date && (
                      <span className={cn('text-[10px] font-medium', isOverdue(item.due_date) && item.status !== 'betaald' ? 'text-red-400' : 'text-gray-400')}>
                        {formatDate(item.due_date)}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-300">{item.created_at?.split('T')[0]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-sm font-bold', item.type === 'inkomst' ? 'text-emerald-600' : 'text-red-500')}>
                    {item.type === 'inkomst' ? '+' : '-'}{formatCurrency(item.amount)}
                  </span>
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

function MiniStat({ icon, label, value, positive, negative, prefix }: {
  icon: React.ReactNode; label: string; value: string; positive?: boolean; negative?: boolean; prefix?: string
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn('flex-shrink-0', positive ? 'text-emerald-500' : negative ? 'text-red-400' : 'icon-gradient')}>{icon}</span>
        <span className="text-[10px] text-gray-400 font-medium truncate">{label}</span>
      </div>
      <p className={cn('text-sm sm:text-base font-extrabold', positive ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-gradient')}>
        {prefix}{value}
      </p>
    </div>
  )
}

function FinanceAnalysisPanel({
  analyseResult,
  showAnalyse,
  setShowAnalyse,
  applyingRuleKey,
  onApplyRule,
  onUpdateTransaction,
}: {
  analyseResult: AnalyseResult
  showAnalyse: boolean
  setShowAnalyse: React.Dispatch<React.SetStateAction<boolean>>
  applyingRuleKey: string | null
  onApplyRule: (questionKey: string, rulePatch: Record<string, unknown>) => Promise<void>
  onUpdateTransaction: (id: number, data: Record<string, unknown>) => Promise<void>
}) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null)

  return (
    <div className="mx-4 sm:mx-6 mt-3 rounded-3xl border border-violet-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 overflow-hidden">
      <button
        onClick={() => setShowAnalyse(s => !s)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: GRAD }}>
            <Sparkles size={13} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800">Financiële Analyse</p>
            <p className="text-[10px] text-gray-400">
              {analyseResult.summary.transactionCount} transacties · €{analyseResult.summary.fixedMonthlyCost}/mnd vaste lasten · €{analyseResult.summary.subscriptionMonthlyCost}/mnd abonnementen
            </p>
          </div>
        </div>
        {showAnalyse ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {showAnalyse && (
        <div className="px-5 pb-5 space-y-5">
          {analyseResult.aiInsights && (
            <div className="bg-white/80 rounded-2xl p-4 border border-white shadow-sm">
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <Sparkles size={11} className="text-pink-400" />
                AI Inzichten
              </p>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{analyseResult.aiInsights}</p>
            </div>
          )}

          {analyseResult.reviewQuestions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-red-400" />
                Eerst bevestigen ({analyseResult.reviewQuestions.length})
              </p>
              <div className="space-y-2">
                {analyseResult.reviewQuestions.map(question => (
                  <div key={question.queueKey} className="rounded-2xl border border-red-100 bg-white/90 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{question.prompt}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{question.rationale}</p>
                      </div>
                      <span className={cn('px-2 py-1 rounded-full border text-[10px] font-semibold whitespace-nowrap', CONFIDENCE_STYLE[question.confidenceLabel])}>
                        {confidenceText(question.confidenceLabel)}
                      </span>
                    </div>

                    <input
                      type="text"
                      placeholder="Voeg notitie toe..."
                      value={notes[question.queueKey] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [question.queueKey]: e.target.value }))}
                      className="w-full mt-3 px-3 py-2 text-xs border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-100 bg-white/50"
                    />

                    <div className="flex flex-wrap gap-2 mt-3">
                      {question.suggestedActions.map(action => (
                        <button
                          key={action.label}
                          onClick={() => onApplyRule(question.queueKey, { ...action.rulePatch, notes: notes[question.queueKey] })}
                          disabled={applyingRuleKey === question.queueKey}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-gray-200 text-gray-600 hover:border-pink-200 hover:text-gray-800 disabled:opacity-60"
                        >
                          {applyingRuleKey === question.queueKey ? 'Opslaan...' : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analyseResult.recurringGroups.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <Repeat size={11} className="text-violet-400" />
                Terugkerende uitgaven ({analyseResult.recurringGroups.length})
                <span className="ml-auto text-[10px] text-violet-500 font-semibold">
                  €{analyseResult.summary.recurringMonthlyCost}/mnd betrouwbaar berekend
                </span>
              </p>
              <div className="space-y-1.5">
                {analyseResult.recurringGroups.slice(0, 8).map(group => (
                  <div key={group.merchantKey} className="flex items-start gap-3 bg-white/80 rounded-xl px-3 py-2.5 border border-white">
                    <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                      <Repeat size={11} className="text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-gray-700 truncate">{group.displayName}</p>
                        <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', CONFIDENCE_STYLE[group.confidenceLabel])}>
                          {confidenceText(group.confidenceLabel)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{group.recurrenceLabel} · {group.count}x gezien · laatste: {group.lastSeen}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{group.explanation}</p>
                      {group.reviewReason && <p className="text-[10px] text-red-500 mt-1">{group.reviewReason}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {group.monthlyEquivalent != null ? (
                        <>
                          <p className="text-xs font-bold text-violet-600">€{group.monthlyEquivalent.toFixed(2)}/mnd</p>
                          <p className="text-[10px] text-gray-400">{group.monthlyEquivalentLabel}</p>
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-400">nog geen betrouwbare maandomrekening</p>
                      )}
                      <p className="text-[10px] text-gray-500 mt-1">€{group.amountPerCharge.toFixed(2)} per keer</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analyseResult.patterns.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <Eye size={11} className="text-pink-400" />
                Meest bij uitgegeven
              </p>
              <div className="space-y-1.5">
                {analyseResult.patterns.slice(0, 6).map((pattern, index) => {
                  const maxSpent = analyseResult.patterns[0]?.totalSpent || 1
                  const pct = Math.round((pattern.totalSpent / maxSpent) * 100)
                  return (
                    <div key={`${pattern.merchant}-${index}`} className="flex items-center gap-3 bg-white/80 rounded-xl px-3 py-2 border border-white">
                      <span className="text-[10px] text-gray-400 w-4 text-center">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <p className="text-xs font-medium text-gray-700 truncate">{pattern.merchant}</p>
                          <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', CONFIDENCE_STYLE[pattern.confidenceLabel])}>
                            {confidenceText(pattern.confidenceLabel)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: GRAD }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{pattern.visits}x</span>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-gray-800 ml-2 flex-shrink-0">€{pattern.totalSpent.toFixed(0)}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {analyseResult.trends.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <BarChart2 size={11} className="text-orange-400" />
                Maandtrend
              </p>
              <div className="space-y-1.5">
                {analyseResult.trends.slice(-4).map(trend => (
                  <div key={trend.month} className="flex items-center gap-3 bg-white/80 rounded-xl px-3 py-2.5 border border-white">
                    <span className="text-[10px] font-medium text-gray-500 w-14 flex-shrink-0">{trend.month}</span>
                    <div className="flex-1 flex gap-2 text-[10px]">
                      <span className="text-emerald-600 font-semibold">+€{trend.income.toFixed(0)}</span>
                      <span className="text-red-400">-€{trend.expenses.toFixed(0)}</span>
                    </div>
                    <span className={cn('text-xs font-bold flex-shrink-0', trend.net >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {trend.net >= 0 ? '+' : ''}€{trend.net.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analyseResult.anomalies.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-amber-400" />
                Opvallende transacties ({analyseResult.anomalies.length})
              </p>
              <div className="space-y-1.5">
                {analyseResult.anomalies.map(anomaly => {
                  const colors = { high: 'bg-red-50 border-red-100 text-red-600', medium: 'bg-amber-50 border-amber-100 text-amber-600', low: 'bg-gray-50 border-gray-100 text-gray-500' }
                  const noteKey = anomaly.id ? `anomaly-${anomaly.id}` : `anomaly-${anomaly.title}-${anomaly.date}`
                  return (
                    <div key={`${anomaly.title}-${anomaly.date}-${anomaly.amount}`} className={`flex flex-col gap-2 rounded-xl px-3 py-2.5 border ${colors[anomaly.severity]}`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{anomaly.title}</p>
                          <p className="text-[10px] opacity-70">{anomaly.reason}</p>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0">{formatCurrency(anomaly.amount)}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Verklaring (bijv. wat was dit?)"
                          value={notes[noteKey] || ''}
                          onChange={(e) => setNotes(prev => ({ ...prev, [noteKey]: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 text-[10px] border border-black/5 rounded-lg focus:outline-none bg-white/40 placeholder:text-black/30"
                        />
                        {anomaly.id && (
                          <button
                            onClick={async () => {
                              setSavingNoteId(anomaly.id!)
                              await onUpdateTransaction(anomaly.id!, { user_notes: notes[noteKey], user_verified: true })
                              setSavingNoteId(null)
                            }}
                            disabled={savingNoteId === anomaly.id || !notes[noteKey]}
                            className="px-3 py-1.5 rounded-lg bg-white/60 text-[10px] font-bold hover:bg-white/80 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {savingNoteId === anomaly.id ? 'Bezig...' : 'Opslaan'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
