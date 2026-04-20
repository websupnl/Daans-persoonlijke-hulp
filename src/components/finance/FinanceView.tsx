'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  Euro,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn, formatCurrency } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/interfaces-select'
import { Textarea } from '@/components/ui/interfaces-textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/material-ui-dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActionSearchBar, type Action } from '@/components/ui/action-search-bar'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, Divider, EmptyPanel, MetricTile, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'
import TransactionModal from './TransactionModal'
import AIContextButton from '@/components/ai/AIContextButton'

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
  total_balance_prive: number
  total_balance_zakelijk: number
}

interface Balance {
  account: string
  balance: number
  updated_at: string
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
  subcategory?: string
  merchant_raw?: string
  merchant_normalized?: string
  category_confidence?: number
  is_duplicate?: boolean
}

interface AnalyseResult {
  recurringGroups: Array<{
    merchantKey: string
    displayName: string
    recurrenceLabel: string
    confidenceLabel: 'high' | 'medium' | 'low'
    monthlyEquivalent: number | null
    explanation: string
  }>
  anomalies: Array<{
    id?: number
    title: string
    amount: number
    date: string
    reason: string
    severity: 'low' | 'medium' | 'high'
  }>
  reviewQuestions: Array<{
    queueKey: string
    merchantLabel: string
    prompt: string
    rationale: string
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

const TYPE_FILTERS = ['Alles', 'Inkomsten', 'Uitgaven'] as const
const ACCOUNT_FILTERS = ['Alle rekeningen', 'Prive', 'Zakelijk', 'Spaar Prive', 'Spaar Zakelijk'] as const
const ACCOUNT_VALUES: Record<string, string | null> = {
  'Alle rekeningen': null,
  Prive: 'privÃ©',
  Zakelijk: 'zakelijk',
  'Spaar Prive': 'spaar-privÃ©',
  'Spaar Zakelijk': 'spaar-zakelijk',
}
const CATEGORY_OPTIONS = ['overig', 'boodschappen', 'auto', 'transport', 'eten', 'abonnement', 'belasting', 'vaste lasten', 'kleding', 'buffer', 'btw', 'sparen']
const VIEW_MODES = ['day', 'week', 'month'] as const
const CONFIDENCE_TEXT: Record<'high' | 'medium' | 'low', string> = {
  high: 'zeker',
  medium: 'waarschijnlijk',
  low: 'twijfelachtig',
}

function accountLabel(account: string) {
  if (account === 'privÃ©') return 'Prive'
  if (account === 'spaar-privÃ©') return 'Spaar Prive'
  if (account === 'spaar-zakelijk') return 'Spaar Zakelijk'
  if (account === 'zakelijk') return 'Zakelijk'
  return account
}

function periodLabel(mode: (typeof VIEW_MODES)[number], currentDate: Date) {
  if (mode === 'day') return format(currentDate, 'EEEE d MMMM', { locale: nl })
  if (mode === 'week') {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    const end = endOfWeek(currentDate, { weekStartsOn: 1 })
    return `${format(start, 'd MMM', { locale: nl })} - ${format(end, 'd MMM', { locale: nl })}`
  }
  return format(currentDate, 'MMMM yyyy', { locale: nl })
}

export default function FinanceView() {
  const [items, setItems] = useState<FinanceItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('Alles')
  const [accountFilter, setAccountFilter] = useState<(typeof ACCOUNT_FILTERS)[number]>('Alle rekeningen')
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceItem | null>(null)

  const [form, setForm] = useState({
    type: 'uitgave' as 'inkomst' | 'uitgave',
    title: '',
    amount: '',
    due_date: '',
    category: 'overig',
    account: 'privÃ©',
  })
  const [editingItem, setEditingItem] = useState<FinanceItem | null>(null)
  const [adjustForm, setAdjustForm] = useState({ account: 'privÃ©', actual_balance: '' })

  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [analyseResult, setAnalyseResult] = useState<AnalyseResult | null>(null)
  const [analyseLoading, setAnalyseLoading] = useState(false)
  const [analyseError, setAnalyseError] = useState<string | null>(null)

  const [importMethod, setImportMethod] = useState<'csv' | 'ai'>('csv')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importText, setImportText] = useState('')
  const [importAccount, setImportAccount] = useState('privÃ©')
  const [importPreview, setImportPreview] = useState<ImportRow[] | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const dateRange = useMemo(() => {
    if (viewMode === 'day') {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) }
    }
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      }
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
  }, [viewMode, currentDate])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter === 'Inkomsten') params.set('type', 'inkomst')
    else if (typeFilter === 'Uitgaven') params.set('type', 'uitgave')

    const accountValue = ACCOUNT_VALUES[accountFilter]
    if (accountValue) params.set('account', accountValue)

    params.set('from', format(dateRange.start, 'yyyy-MM-dd'))
    params.set('to', format(dateRange.end, 'yyyy-MM-dd'))

    const [financeResponse, statsResponse, balanceResponse] = await Promise.all([
      fetch(`/api/finance?${params}`).then((response) => response.json()),
      fetch(`/api/finance/stats?from=${format(dateRange.start, 'yyyy-MM-dd')}&to=${format(dateRange.end, 'yyyy-MM-dd')}`)
        .then((response) => response.json())
        .catch(() => ({ categories: [], monthly: [] })),
      fetch('/api/finance/balances')
        .then((response) => response.json())
        .catch(() => ({ data: [] })),
    ])

    const filteredItems = (financeResponse.data || []).filter((item: { type?: string }) => item.type !== 'factuur')
    setItems(filteredItems as FinanceItem[])
    setStats(financeResponse.stats)
    setCategoryStats(statsResponse.categories || [])
    setMonthlyData(statsResponse.monthly || [])
    setBalances(balanceResponse.data || [])
    setLoading(false)
  }, [accountFilter, dateRange.end, dateRange.start, typeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'finance' }),
    })
      .then((response) => response.json())
      .then((payload) => setAiSummary(payload.summary ?? null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editingItem) return
    setForm({
      type: editingItem.type,
      title: editingItem.title,
      amount: String(editingItem.amount),
      due_date: editingItem.due_date ? editingItem.due_date.split('T')[0] : '',
      category: editingItem.category,
      account: editingItem.account,
    })
    setShowAdd(true)
  }, [editingItem])

  async function addItem() {
    if (!form.title.trim()) return
    const url = editingItem ? `/api/finance/${editingItem.id}` : '/api/finance'
    const method = editingItem ? 'PATCH' : 'POST'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0 }),
    })

    setForm({ type: 'uitgave', title: '', amount: '', due_date: '', category: 'overig', account: 'privÃ©' })
    setEditingItem(null)
    setShowAdd(false)
    fetchData()
  }

  async function deleteItem(id: number) {
    await fetch(`/api/finance/${id}`, { method: 'DELETE' })
    setItems((previous) => previous.filter((item) => item.id !== id))
    if (selectedTransaction?.id === id) setSelectedTransaction(null)
  }

  async function updateTransaction(id: number, data: Record<string, unknown>) {
    const response = await fetch(`/api/finance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const payload = await response.json()
    if (payload.data) {
      setSelectedTransaction(payload.data)
    }
    fetchData()
  }

  async function copyItem(item: FinanceItem) {
    setEditingItem(null)
    setForm({
      type: item.type,
      title: `${item.title} (kopie)`,
      amount: String(item.amount),
      due_date: new Date().toISOString().split('T')[0],
      category: item.category,
      account: item.account,
    })
    setShowAdd(true)
    setShowImport(false)
    setShowAdjust(false)
  }

  async function handleAdjust() {
    if (!adjustForm.actual_balance) return
    await fetch('/api/finance/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: adjustForm.account,
        balance: parseFloat(adjustForm.actual_balance),
      }),
    })
    setAdjustForm({ account: 'privÃ©', actual_balance: '' })
    setShowAdjust(false)
    fetchData()
  }

  async function runAnalyse() {
    setAnalyseLoading(true)
    setAnalyseError(null)
    try {
      const response = await fetch('/api/finance/analyse', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        setAnalyseError(payload.error ?? 'Analyse mislukt')
        return
      }
      setAnalyseResult(payload)
    } catch {
      setAnalyseError('Verbindingsfout')
    } finally {
      setAnalyseLoading(false)
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setImportFile(file)
    setImportLoading(true)
    setImportError(null)
    setImportPreview(null)
    setImportResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('import', 'false')
    formData.append('account', importAccount)

    try {
      const response = await fetch('/api/finance/import', { method: 'POST', body: formData })
      const payload = await response.json()
      if (!response.ok) {
        setImportError(payload.error ?? 'Parseren mislukt')
        return
      }
      setImportPreview(payload.preview)
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
      const response = await fetch('/api/finance/import/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText, account: importAccount }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setImportError(payload.error ?? 'AI parseren mislukt')
        return
      }
      setImportPreview(payload.preview)
    } catch {
      setImportError('Verbindingsfout')
    } finally {
      setImportLoading(false)
    }
  }

  async function doImport() {
    setImportLoading(true)
    setImportError(null)

    try {
      let response: Response
      if (importMethod === 'csv') {
        if (!importFile) return
        const formData = new FormData()
        formData.append('file', importFile)
        formData.append('import', 'true')
        formData.append('account', importAccount)
        response = await fetch('/api/finance/import', { method: 'POST', body: formData })
      } else {
        response = await fetch('/api/finance/import/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: importPreview, account: importAccount }),
        })
      }

      const payload = await response.json()
      if (!response.ok) {
        setImportError(payload.error ?? 'Import mislukt')
        return
      }

      setImportResult(payload)
      setImportPreview(null)
      setImportText('')
      setImportFile(null)
      if (fileRef.current) fileRef.current.value = ''
      fetchData()
    } catch {
      setImportError('Verbindingsfout')
    } finally {
      setImportLoading(false)
    }
  }

  const net = (stats?.month_income || 0) - (stats?.month_expenses || 0)
  const incomeItems = items.filter((item) => item.type === 'inkomst')
  const expenseItems = items.filter((item) => item.type === 'uitgave')
  const biggestExpense = [...expenseItems].sort((left, right) => right.amount - left.amount)[0]
  const currentBalance = balances.reduce((sum, balance) => sum + (Number(balance.balance) || 0), 0) || 0
  const maxMonthly = monthlyData.reduce((max, item) => Math.max(max, item.income, item.expenses), 1)
  const searchActions = useMemo<Action[]>(
    () => [
      {
        id: 'command:new-transaction',
        label: 'Nieuwe transactie',
        icon: <Plus className="h-4 w-4 text-emerald-500" />,
        description: 'Nieuwe regel toevoegen',
        end: 'Command',
      },
      {
        id: 'command:import',
        label: 'Import openen',
        icon: <Upload className="h-4 w-4 text-blue-500" />,
        description: 'CSV of AI import',
        end: 'Command',
      },
      {
        id: 'command:analyse',
        label: 'Financiële analyse',
        icon: <Sparkles className="h-4 w-4 text-violet-500" />,
        description: 'Laat AI meekijken',
        end: 'Command',
      },
      ...items.slice(0, 12).map((item) => ({
        id: `transaction:${item.id}`,
        label: item.title,
        icon: <Euro className={`h-4 w-4 ${item.type === 'inkomst' ? 'text-emerald-500' : 'text-[#a55a2c]'}`} />,
        description: `${accountLabel(item.account)} · ${item.category}`,
        end: formatCurrency(item.amount),
      })),
    ],
    [items]
  )

  return (
    <>
      <PageShell
        title="Financien"
        subtitle={`${periodLabel(viewMode, currentDate)} · Overzicht van je inkomsten en uitgaven`}
        desktopSearch={
          <ActionSearchBar
            actions={searchActions}
            label="Zoek transacties"
            placeholder="Zoek transactie of actie..."
            onActionSelect={(action) => {
              if (action.id === 'command:new-transaction') {
                setShowAdd(true)
                setShowImport(false)
                setShowAdjust(false)
                return
              }
              if (action.id === 'command:import') {
                setShowImport(true)
                setShowAdd(false)
                setShowAdjust(false)
                return
              }
              if (action.id === 'command:analyse') {
                void runAnalyse()
                return
              }
              if (action.id.startsWith('transaction:')) {
                const found = items.find((item) => item.id === Number(action.id.split(':')[1]))
                if (found) setSelectedTransaction(found)
              }
            }}
          />
        }
        actions={
          <>
            <div className="flex rounded-full border border-outline-variant bg-white p-1">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === mode ? 'bg-accent text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
                  )}
                >
                  {mode === 'day' ? 'Dag' : mode === 'week' ? 'Week' : 'Maand'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (viewMode === 'day') setCurrentDate((previous) => addDays(previous, -1))
                else if (viewMode === 'week') setCurrentDate((previous) => addWeeks(previous, -1))
                else setCurrentDate((previous) => addMonths(previous, -1))
              }}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant bg-white text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              {periodLabel(viewMode, currentDate)}
            </button>
            <button
              onClick={() => {
                if (viewMode === 'day') setCurrentDate((previous) => addDays(previous, 1))
                else if (viewMode === 'week') setCurrentDate((previous) => addWeeks(previous, 1))
                else setCurrentDate((previous) => addMonths(previous, 1))
              }}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant bg-white text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                setShowImport((value) => !value)
                setShowAdd(false)
                setShowAdjust(false)
              }}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Upload size={15} />
              Import
            </button>
            <button
              onClick={() => {
                setShowAdd((value) => !value)
                setEditingItem(null)
                setForm({ type: 'uitgave', title: '', amount: '', due_date: '', category: 'overig', account: 'privÃ©' })
                setShowImport(false)
                setShowAdjust(false)
              }}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
            >
              <Plus size={15} />
              Nieuwe transactie
            </button>
          </>
        }
      >
        <StatStrip stats={[
          { label: 'Saldo', value: formatCurrency(currentBalance), meta: `${balances.length} rekening${balances.length === 1 ? '' : 'en'}`, accent: currentBalance >= 0 ? 'green' : 'red' },
          { label: 'Netto', value: formatCurrency(net), meta: `${formatCurrency(stats?.month_income || 0)} in / ${formatCurrency(stats?.month_expenses || 0)} uit`, accent: net >= 0 ? 'green' : 'red' },
          { label: 'Openstaand', value: formatCurrency(stats?.open_amount || 0), meta: `${stats?.open_count || 0} facturen`, accent: (stats?.open_count || 0) > 0 ? 'amber' : undefined },
        ]} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <Tabs value={showAdd ? 'add' : showImport ? 'import' : showAdjust ? 'adjust' : analyseResult ? 'analyse' : 'transactions'} 
                  onValueChange={(v) => {
                    setShowAdd(v === 'add')
                    setShowImport(v === 'import')
                    setShowAdjust(v === 'adjust')
                  }}
                  className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="transactions">Transacties</TabsTrigger>
                <TabsTrigger value="add">Toevoegen</TabsTrigger>
                <TabsTrigger value="import">Import</TabsTrigger>
                <TabsTrigger value="adjust">Correctie</TabsTrigger>
                <TabsTrigger value="analyse" disabled={!analyseResult}>Analyse</TabsTrigger>
              </TabsList>

              <TabsContent value="add" className="mt-0 space-y-4">
                <Panel tone="accent">
                  <PanelHeader
                    eyebrow="Nieuwe transactie"
                    title={editingItem ? 'Bewerk transactie' : 'Voeg transactie toe'}
                    description="Registratie moet snel blijven. Eerst de kern, daarna pas extra nuance."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <input
                      value={form.title}
                      onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Omschrijving"
                      className="md:col-span-2 xl:col-span-2 rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    />
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                      placeholder="Bedrag"
                      className="rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    />
                    <Select
                      value={form.type}
                      onValueChange={(value) => setForm((current) => ({ ...current, type: value as 'inkomst' | 'uitgave' }))}
                    >
                      <SelectTrigger className="w-full rounded-2xl px-4 py-3 text-sm">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uitgave">Uitgave</SelectItem>
                        <SelectItem value="inkomst">Inkomst</SelectItem>
                      </SelectContent>
                    </Select>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                      className="rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface outline-none"
                    />
                    <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                      <SelectTrigger className="w-full rounded-2xl px-4 py-3 text-sm">
                        <SelectValue placeholder="Categorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={form.account} onValueChange={(value) => setForm((current) => ({ ...current, account: value }))}>
                      <SelectTrigger className="w-full rounded-2xl px-4 py-3 text-sm">
                        <SelectValue placeholder="Rekening" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="priv?">Prive</SelectItem>
                        <SelectItem value="zakelijk">Zakelijk</SelectItem>
                        <SelectItem value="spaar-priv?">Spaar Prive</SelectItem>
                        <SelectItem value="spaar-zakelijk">Spaar Zakelijk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={addItem}
                      className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                    >
                      {editingItem ? 'Opslaan' : 'Toevoegen'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAdd(false)
                        setEditingItem(null)
                      }}
                      className="rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                    >
                      Annuleer
                    </button>
                  </div>
                </Panel>
              </TabsContent>

              <TabsContent value="import" className="mt-0 space-y-4">
              <Panel tone="accent">
                <PanelHeader
                  eyebrow="Import"
                  title="Bankgegevens inladen"
                  description="Import hoort gecontroleerd te voelen: eerst preview, dan pas opslaan."
                />

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => setImportMethod('csv')}
                    className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors', importMethod === 'csv' ? 'bg-accent text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low')}
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => setImportMethod('ai')}
                    className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors', importMethod === 'ai' ? 'bg-accent text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low')}
                  >
                    AI parse
                  </button>
                  <Select value={importAccount} onValueChange={setImportAccount}>
                    <SelectTrigger className="w-[170px] rounded-full px-3.5 py-1.5 text-xs font-medium">
                      <SelectValue placeholder="Rekening" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priv?">Prive</SelectItem>
                      <SelectItem value="zakelijk">Zakelijk</SelectItem>
                      <SelectItem value="spaar-priv?">Spaar Prive</SelectItem>
                      <SelectItem value="spaar-zakelijk">Spaar Zakelijk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-5 space-y-3">
                  {importMethod === 'csv' ? (
                    <div className="rounded-xl border border-dashed border-outline-variant/40 bg-white/55 px-4 py-6">
                      <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileSelect} className="text-sm text-on-surface" />
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={importText}
                        onChange={(event) => setImportText(event.target.value)}
                        placeholder="Plak hier ruwe banktekst of PDF-export"
                        className="min-h-[180px] resize-none rounded-xl border-outline-variant bg-white px-4 py-4 text-sm leading-7 text-on-surface placeholder:text-on-surface-variant"
                      />
                      <button
                        onClick={handleAiParse}
                        disabled={importLoading || !importText.trim()}
                        className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                      >
                        {importLoading ? 'Bezig...' : 'Maak preview'}
                      </button>
                    </>
                  )}

                  {importError && (
                    <div className="rounded-xl border border-[#e5c6b8] bg-[#fff7eb] px-4 py-3 text-sm text-[#9b6941]">
                      {importError}
                    </div>
                  )}

                  {importResult && (
                    <div className="rounded-xl border border-outline-variant bg-white/70 px-4 py-3 text-sm text-on-surface">
                      {importResult.imported} van {importResult.total} transacties opgeslagen.
                    </div>
                  )}

                  {importPreview && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-on-surface">Preview</p>
                        <button
                          onClick={doImport}
                          disabled={importLoading}
                          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                        >
                          {importLoading ? 'Importeren...' : 'Importeer nu'}
                        </button>
                      </div>

                      <div className="space-y-2">
                        {importPreview.slice(0, 8).map((row, index) => (
                          <div key={`${row.description}-${index}`} className="rounded-xl border border-outline-variant bg-white/70 px-4 py-3.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-on-surface">{row.description}</p>
                                <p className="mt-1 text-xs text-on-surface-variant">
                                  {row.date} | {row.category}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={cn('text-sm font-bold', row.type === 'inkomst' ? 'text-emerald-600' : 'text-[#a55a2c]')}>
                                  {row.type === 'inkomst' ? '+' : '-'}{formatCurrency(row.amount)}
                                </p>
                                {row.is_duplicate && <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">dubbel</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="adjust" className="mt-0 space-y-4">
              <Panel tone="accent">
                <PanelHeader
                  eyebrow="Kasverschil"
                  title="Balans corrigeren"
                  description="Gebruik dit alleen als de echte rekeningstand afwijkt van je geregistreerde transacties."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Select value={adjustForm.account} onValueChange={(value) => setAdjustForm((current) => ({ ...current, account: value }))}>
                    <SelectTrigger className="w-full rounded-2xl px-4 py-3 text-sm">
                      <SelectValue placeholder="Rekening" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priv?">Prive</SelectItem>
                      <SelectItem value="zakelijk">Zakelijk</SelectItem>
                      <SelectItem value="spaar-priv?">Spaar Prive</SelectItem>
                      <SelectItem value="spaar-zakelijk">Spaar Zakelijk</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="number"
                    value={adjustForm.actual_balance}
                    onChange={(event) => setAdjustForm((current) => ({ ...current, actual_balance: event.target.value }))}
                    placeholder="Werkelijke stand"
                    className="rounded-2xl border border-outline-variant bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleAdjust}
                    className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                  >
                    Corrigeer
                  </button>
                  <button
                    onClick={() => setShowAdjust(false)}
                    className="rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    Annuleer
                  </button>
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="transactions" className="mt-0 space-y-4">
            <Panel tone="muted">
              <PanelHeader
                eyebrow="Filters"
                title="Breng ruis terug"
                description="Financien worden pas bruikbaar als je snel kunt inzoomen op periode, rekening en type."
                action={
                  <button
                    onClick={() => {
                      setShowAdjust((value) => !value)
                      setShowAdd(false)
                      setShowImport(false)
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                  >
                    <RefreshCw size={12} />
                    Kasverschil
                  </button>
                }
              />

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((item) => (
                    <button
                      key={item}
                      onClick={() => setTypeFilter(item)}
                      className={cn('rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors', typeFilter === item ? 'bg-accent text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low')}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_FILTERS.map((item) => (
                    <button
                      key={item}
                      onClick={() => setAccountFilter(item)}
                      className={cn('rounded-full border border-outline-variant px-3 py-1.5 text-xs font-medium transition-colors', accountFilter === item ? 'bg-surface-container-high text-on-surface' : 'bg-white text-on-surface-variant hover:bg-surface-container-low')}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel padding="sm">
              <PanelHeader
                eyebrow="Transacties"
                title={`${items.length} regels in beeld`}
                description="De lijst moet compact, scanbaar en betrouwbaar blijven. Details open je alleen als je ze nodig hebt."
                className="px-2 pb-2"
              />

              {loading ? (
                <div className="flex min-h-[280px] items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-on-surface-variant" />
                </div>
              ) : items.length === 0 ? (
                <EmptyPanel
                  title="Geen transacties in deze selectie"
                  description="Dat kan betekenen dat je filters scherp staan, of dat er voor deze periode gewoon weinig beweging was."
                />
              ) : (
                <>
                  <div className="mt-2 space-y-1 lg:hidden">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedTransaction(item)}
                        className="group block w-full rounded-xl px-4 py-3.5 text-left transition-colors hover:bg-surface-container-low"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-2">
                              <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                              <ActionPill>{item.category}</ActionPill>
                              <ActionPill>{accountLabel(item.account)}</ActionPill>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                              <span>{item.contact_name || item.status}</span>
                              <span>{item.due_date ? format(new Date(item.due_date), 'd MMM yyyy', { locale: nl }) : format(new Date(item.created_at), 'd MMM yyyy', { locale: nl })}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn('text-sm font-bold', item.type === 'inkomst' ? 'text-emerald-600' : 'text-[#a55a2c]')}>
                              {item.type === 'inkomst' ? '+' : '-'}{formatCurrency(item.amount)}
                            </p>
                            <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                              <AIContextButton type="finance" title={item.title} content={item.user_notes} id={item.id} />
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <MoreHorizontal size={13} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="min-w-[12rem] rounded-2xl bg-white">
                                  <DropdownMenuItem onSelect={() => copyItem(item)}>
                                    <Copy size={13} />
                                    <span>Kopie maken</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => setEditingItem(item)}>
                                    <Plus size={13} className="rotate-45" />
                                    <span>Bewerken</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-[#a55a2c]" onSelect={() => deleteItem(item.id)}>
                                    <Trash2 size={13} />
                                    <span>Verwijderen</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 hidden lg:block" data-slot="frame">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Datum</TableHead>
                          <TableHead>Omschrijving</TableHead>
                          <TableHead>Rekening</TableHead>
                          <TableHead>Categorie</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Bedrag</TableHead>
                          <TableHead className="text-right">Acties</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-on-surface-variant">
                              {item.due_date ? format(new Date(item.due_date), 'd MMM yyyy', { locale: nl }) : format(new Date(item.created_at), 'd MMM yyyy', { locale: nl })}
                            </TableCell>
                            <TableCell className="font-medium">
                              <button onClick={() => setSelectedTransaction(item)} className="max-w-[240px] truncate text-left text-on-surface hover:text-accent">
                                {item.title}
                              </button>
                            </TableCell>
                            <TableCell>{accountLabel(item.account)}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-on-surface-variant">{item.contact_name || item.status}</TableCell>
                            <TableCell className={cn('text-right font-bold', item.type === 'inkomst' ? 'text-emerald-600' : 'text-[#a55a2c]')}>
                              {item.type === 'inkomst' ? '+' : '-'}{formatCurrency(item.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <AIContextButton type="finance" title={item.title} content={item.user_notes} id={item.id} />
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface">
                                    <MoreHorizontal size={13} />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="min-w-[12rem] rounded-2xl bg-white">
                                    <DropdownMenuItem onSelect={() => copyItem(item)}>
                                      <Copy size={13} />
                                      <span>Kopie maken</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setEditingItem(item)}>
                                      <Plus size={13} className="rotate-45" />
                                      <span>Bewerken</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-[#a55a2c]" onSelect={() => deleteItem(item.id)}>
                                      <Trash2 size={13} />
                                      <span>Verwijderen</span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </Panel>
            </TabsContent>

            <TabsContent value="analyse" className="mt-0 space-y-4">
              {analyseResult && (
                <Panel>
                <PanelHeader
                  eyebrow="Analyse"
                  title="AI financieel beeld"
                  description="Analyse hoort gericht te zijn op signalen en beslissingen, niet op decoratieve rapportjes."
                />

                <div className="mt-5 space-y-5">
                  {analyseResult.aiInsights && (
                    <div className="rounded-xl border border-outline-variant bg-white/70 px-4 py-4">
                      <p className="text-sm leading-7 text-on-surface">{analyseResult.aiInsights}</p>
                    </div>
                  )}

                  <StatStrip stats={[
                    { label: 'Netto', value: formatCurrency(analyseResult.summary.net) },
                    { label: 'Terugkerend', value: formatCurrency(analyseResult.summary.recurringMonthlyCost), meta: 'geschat/mnd' },
                    { label: 'Vaste lasten', value: formatCurrency(analyseResult.summary.fixedMonthlyCost) },
                    { label: 'Twijfel', value: analyseResult.summary.uncertainRecurringCount, meta: 'merchants' },
                  ]} />

                  {analyseResult.recurringGroups.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                        Terugkerende patronen
                      </p>
                      {analyseResult.recurringGroups.slice(0, 5).map((group, index) => (
                        <div key={group.merchantKey}>
                          {index > 0 && <Divider />}
                          <div className="rounded-lg px-2 py-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-on-surface">{group.displayName}</p>
                                <p className="text-xs text-on-surface-variant">{group.recurrenceLabel} | {CONFIDENCE_TEXT[group.confidenceLabel]}</p>
                              </div>
                              {group.monthlyEquivalent != null && (
                                <p className="text-sm font-bold text-on-surface">{formatCurrency(group.monthlyEquivalent)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {analyseResult.anomalies.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                        Opvallende afwijkingen
                      </p>
                      {analyseResult.anomalies.slice(0, 4).map((anomaly, index) => (
                        <div key={`${anomaly.title}-${index}`}>
                          {index > 0 && <Divider />}
                          <div className="flex items-start justify-between gap-3 rounded-lg px-2 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-on-surface">{anomaly.title}</p>
                              <p className="text-xs text-on-surface-variant">{anomaly.reason}</p>
                            </div>
                            <p className="text-sm font-bold text-[#9b6941]">{formatCurrency(anomaly.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {analyseResult.reviewQuestions.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                        Nog te bevestigen
                      </p>
                      {analyseResult.reviewQuestions.slice(0, 4).map((question) => (
                        <div key={question.queueKey} className="rounded-xl border border-outline-variant bg-white/70 px-4 py-3.5">
                          <p className="text-sm font-semibold text-on-surface">{question.merchantLabel}</p>
                          <p className="mt-2 text-xs leading-5 text-on-surface-variant">{question.prompt}</p>
                          <p className="mt-2 text-xs leading-5 text-on-surface-variant">{question.rationale}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
              )}
            </TabsContent>
          </Tabs>
          </div>

          <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
            <Panel tone="accent">
              <PanelHeader
                eyebrow="Samenvatting"
                title="Wat je geld nu zegt"
                description="Een goede finance-rail vertelt meteen waar de spanning zit."
              />

              <div className="mt-5 space-y-3">
                {aiSummary ? (
                  <p className="text-sm leading-7 text-on-surface">{aiSummary}</p>
                ) : (
                  <EmptyPanel
                    title="Nog geen AI samenvatting"
                    description="De pagina werkt zonder AI, maar een goede samenvatting helpt sneller de juiste financiele vraag te stellen."
                  />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                eyebrow="Rekeningen"
                title="Balansen"
                description="Geregistreerde en werkelijke stand moeten hier naast elkaar leesbaar zijn."
              />

              <div className="mt-4">
                {[
                  { account: 'privÃ©', calc: stats?.total_balance_prive || 0 },
                  { account: 'zakelijk', calc: stats?.total_balance_zakelijk || 0 },
                ].map((entry, index) => {
                  const actual = balances.find((balance) => balance.account === entry.account)
                  const diff = actual ? actual.balance - entry.calc : null
                  return (
                    <div key={entry.account}>
                      {index > 0 && <Divider />}
                      <div className="flex items-center justify-between rounded-lg px-2 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-on-surface">{accountLabel(entry.account)}</p>
                          <p className="text-xs text-on-surface-variant">
                            Berekend {formatCurrency(entry.calc)}{actual ? ` | Werkelijk ${formatCurrency(actual.balance)}` : ''}
                          </p>
                        </div>
                        {diff !== null && (
                          <ActionPill className={Math.abs(diff) > 0.01 ? 'text-[#9b6941]' : ''}>
                            {diff === 0 ? 'OK' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`}
                          </ActionPill>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            <Panel tone="muted">
              <PanelHeader
                eyebrow="Uitgaven"
                title="Topcategorieen"
                description="Welke categorieen vreten in deze periode het meeste weg?"
              />

              <div className="mt-4">
                {categoryStats.length === 0 ? (
                  <EmptyPanel title="Nog geen categoriedata" description="Zodra er genoeg uitgaven in beeld zijn, zie je hier direct waar het zwaartepunt ligt." />
                ) : (
                  categoryStats.map((category, index) => (
                    <div key={category.category}>
                      {index > 0 && <Divider />}
                      <div className="flex items-center justify-between rounded-lg px-2 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-on-surface">{category.category}</p>
                          <p className="text-xs text-on-surface-variant">{category.count} transacties</p>
                        </div>
                        <p className="text-sm font-bold text-on-surface">{formatCurrency(category.total)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                eyebrow="Trend"
                title="Laatste maanden"
                description="Snel zien of inkomen en uitgaven structureel uit elkaar gaan lopen."
              />

              <div className="mt-4">
                {monthlyData.length === 0 ? (
                  <EmptyPanel title="Nog geen maandtrend" description="Vanaf meerdere maanden data wordt dit een bruikbaarder stuurinstrument." />
                ) : (
                  monthlyData.slice(-6).map((month, index) => (
                    <div key={month.month}>
                      {index > 0 && <Divider />}
                      <div className="rounded-lg px-2 py-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-on-surface">{month.month}</p>
                          <p className="text-xs font-semibold text-on-surface-variant">
                            {formatCurrency(month.income - month.expenses)}
                          </p>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] text-on-surface-variant">
                              <span>Inkomsten</span>
                              <span>{formatCurrency(month.income)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(month.income / maxMonthly) * 100}%` }} />
                            </div>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] text-on-surface-variant">
                              <span>Uitgaven</span>
                              <span>{formatCurrency(month.expenses)}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                              <div className="h-full rounded-full bg-[#a55a2c]" style={{ width: `${(month.expenses / maxMonthly) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      </PageShell>

      <TransactionModal
        isOpen={!!selectedTransaction}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onSave={updateTransaction}
        onDelete={async (id: number) => {
          await deleteItem(id)
          setSelectedTransaction(null)
        }}
      />
    </>
  )
}

