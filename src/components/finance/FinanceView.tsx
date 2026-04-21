'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AlertTriangle from '@mui/icons-material/ReportProblem'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import Euro from '@mui/icons-material/Euro'
import MoreHorizontal from '@mui/icons-material/MoreHoriz'
import Sparkles from '@mui/icons-material/AutoAwesome'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { addDays, addMonths, addWeeks, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { nl } from 'date-fns/locale'
import { formatCurrency } from '@/lib/utils'
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

const TYPE_FILTERS = ['Alles', 'Inkomsten', 'Uitgaven'] as const
const ACCOUNT_FILTERS = ['Alle rekeningen', 'Prive', 'Zakelijk'] as const
const ACCOUNT_VALUES: Record<string, string | null> = {
  'Alle rekeningen': null,
  Prive: 'privé',
  Zakelijk: 'zakelijk',
}
const VIEW_MODES = ['day', 'week', 'month'] as const

function accountLabel(account: string) {
  if (account === 'prive' || account === 'privé') return 'Prive'
  if (account === 'zakelijk') return 'Zakelijk'
  if (account === 'spaar-prive' || account === 'spaar-privé') return 'Spaar prive'
  if (account === 'spaar-zakelijk') return 'Spaar zakelijk'
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

function financeInsight(aiSummary: string | null, net: number) {
  if (aiSummary) {
    const cleaned = aiSummary.replace(/\s+/g, ' ').trim()
    const first = cleaned.match(/^(.+?[.!?])\s/)?.[1] || cleaned
    return first.slice(0, 170)
  }
  if (net >= 0) return `Deze periode sta je ${formatCurrency(net)} positief. Houd vooral grote losse uitgaven in beeld.`
  return `Deze periode loopt ${formatCurrency(Math.abs(net))} negatief. Check eerst de grootste uitgaven.`
}

export default function FinanceView() {
  const [items, setItems] = useState<FinanceItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('Alles')
  const [accountFilter, setAccountFilter] = useState<(typeof ACCOUNT_FILTERS)[number]>('Alle rekeningen')
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  const dateRange = useMemo(() => {
    if (viewMode === 'day') return { start: startOfDay(currentDate), end: endOfDay(currentDate) }
    if (viewMode === 'week') return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) }
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

    try {
      const [financeResponse, statsResponse, balanceResponse] = await Promise.all([
        fetch(`/api/finance?${params}`).then((response) => response.json()),
        fetch(`/api/finance/stats?from=${format(dateRange.start, 'yyyy-MM-dd')}&to=${format(dateRange.end, 'yyyy-MM-dd')}`).then((response) => response.json()).catch(() => ({ categories: [] })),
        fetch('/api/finance/balances').then((response) => response.json()).catch(() => ({ data: [] })),
      ])
      setItems((financeResponse.data || []).filter((item: { type?: string }) => item.type !== 'factuur'))
      setStats(financeResponse.stats)
      setCategoryStats(statsResponse.categories || [])
      setBalances(balanceResponse.data || [])
    } finally {
      setLoading(false)
    }
  }, [accountFilter, dateRange.end, dateRange.start, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

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
    if (payload.data) setSelectedTransaction(payload.data)
    await fetchData()
  }

  async function createTransaction(data: Record<string, unknown>) {
    const response = await fetch('/api/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const payload = await response.json()
    if (payload.data) setSelectedTransaction(payload.data)
    await fetchData()
  }

  const net = (stats?.month_income || 0) - (stats?.month_expenses || 0)
  const currentBalance = balances.reduce((sum, balance) => sum + (Number(balance.balance) || 0), 0) || 0

  const columns: GridColDef[] = [
    {
      field: 'due_date',
      headerName: 'Datum',
      width: 120,
      valueGetter: (_, row) => row.due_date || row.created_at,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {format(new Date(params.value), 'd MMM yyyy', { locale: nl })}
        </Typography>
      ),
    },
    {
      field: 'title',
      headerName: 'Omschrijving',
      flex: 1,
      minWidth: 220,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 750, whiteSpace: 'normal', lineHeight: 1.45 }}>{params.value}</Typography>
          {params.row.user_notes && <Typography variant="caption" color="text.secondary">{params.row.user_notes}</Typography>}
        </Box>
      ),
    },
    { field: 'account', headerName: 'Rekening', width: 130, renderCell: (params: GridRenderCellParams) => accountLabel(params.value) },
    { field: 'category', headerName: 'Categorie', width: 130 },
    {
      field: 'amount',
      headerName: 'Bedrag',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" fontWeight={800} color={params.row.type === 'inkomst' ? 'success.main' : 'secondary.main'}>
          {params.row.type === 'inkomst' ? '+' : '-'}{formatCurrency(params.value)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 92,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ height: '100%' }}>
          <AIContextButton type="finance" title={params.row.title} content={params.row.user_notes} id={params.row.id} />
          <IconButton size="small" onClick={(event) => { event.stopPropagation(); setSelectedTransaction(params.row) }} aria-label="Open transactie">
            <MoreHorizontal fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ]

  return (
    <>
      <PageShell
        title="Financien"
        subtitle={`${periodLabel(viewMode, currentDate)} · inkomsten, uitgaven en transacties`}
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <ButtonGroup size="small">
              {VIEW_MODES.map((mode) => (
                <Button key={mode} variant={viewMode === mode ? 'contained' : 'outlined'} onClick={() => setViewMode(mode)} sx={{ fontWeight: 700 }}>
                  {mode === 'day' ? 'Dag' : mode === 'week' ? 'Week' : 'Maand'}
                </Button>
              ))}
            </ButtonGroup>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton size="small" onClick={() => {
                if (viewMode === 'day') setCurrentDate((prev) => addDays(prev, -1))
                else if (viewMode === 'week') setCurrentDate((prev) => addWeeks(prev, -1))
                else setCurrentDate((prev) => addMonths(prev, -1))
              }}>
                <ChevronLeft />
              </IconButton>
              <Button size="small" variant="outlined" onClick={() => setCurrentDate(new Date())} sx={{ minWidth: 136, fontWeight: 700 }}>
                {periodLabel(viewMode, currentDate)}
              </Button>
              <IconButton size="small" onClick={() => {
                if (viewMode === 'day') setCurrentDate((prev) => addDays(prev, 1))
                else if (viewMode === 'week') setCurrentDate((prev) => addWeeks(prev, 1))
                else setCurrentDate((prev) => addMonths(prev, 1))
              }}>
                <ChevronRight />
              </IconButton>
            </Stack>
          </Stack>
        }
      >
        <Stack spacing={3}>
          <AIBriefing title="Geldbriefing" briefing={financeInsight(aiSummary, net)} score={net >= 0 ? 85 : 40} loading={!aiSummary && loading} compact />

          <ModuleStats stats={[
            { icon: <Euro />, label: 'Saldo', value: formatCurrency(currentBalance), helper: `${balances.length} rekeningen`, accent: 'brand' },
            { icon: <TrendingUpIcon />, label: 'Netto', value: formatCurrency(net), helper: `${formatCurrency(stats?.month_income || 0)} in / ${formatCurrency(stats?.month_expenses || 0)} uit`, tone: net >= 0 ? 'good' : 'error' },
            { icon: <AlertTriangle />, label: 'Openstaand', value: formatCurrency(stats?.open_amount || 0), helper: `${stats?.open_count || 0} facturen`, tone: (stats?.open_count || 0) > 0 ? 'warn' : 'default' },
            { icon: <Sparkles />, label: 'Categorieen', value: categoryStats.length, helper: 'Actief in periode', tone: 'good' },
          ]} />

          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {TYPE_FILTERS.map((filter) => (
                  <Chip key={filter} label={filter} onClick={() => setTypeFilter(filter)} variant={typeFilter === filter ? 'filled' : 'outlined'} color={typeFilter === filter ? 'primary' : 'default'} size="small" />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {ACCOUNT_FILTERS.map((filter) => (
                  <Button key={filter} size="small" onClick={() => setAccountFilter(filter)} variant={accountFilter === filter ? 'contained' : 'outlined'} sx={{ fontWeight: 700 }}>
                    {filter}
                  </Button>
                ))}
              </Stack>
            </Stack>

            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={items}
                columns={columns}
                loading={loading}
                pageSizeOptions={[25, 50, 100]}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                getRowHeight={() => 'auto'}
                disableRowSelectionOnClick
                onRowClick={(params) => setSelectedTransaction(params.row as FinanceItem)}
                sx={{
                  border: 'none',
                  '& .MuiDataGrid-cell': { py: 1.25, alignItems: 'center' },
                  '& .MuiDataGrid-columnHeader[data-field="title"], & .MuiDataGrid-cell[data-field="title"]': {
                    position: { xs: 'sticky', md: 'static' },
                    left: 0,
                    zIndex: 2,
                    bgcolor: 'background.paper',
                    boxShadow: { xs: '8px 0 12px -12px rgba(15,15,16,0.45)', md: 'none' },
                  },
                  '& .MuiDataGrid-cell:focus': { outline: 'none' },
                }}
              />
            </Box>
          </Box>
        </Stack>
      </PageShell>

      <TransactionModal
        isOpen={showAdd || !!selectedTransaction}
        transaction={selectedTransaction}
        onClose={() => { setSelectedTransaction(null); setShowAdd(false) }}
        onSave={updateTransaction}
        onCreate={createTransaction}
        onDelete={async (id: number) => {
          await deleteItem(id)
          setSelectedTransaction(null)
        }}
      />
      <FloatingActionButton label="Nieuwe transactie" onClick={() => setShowAdd(true)} />
    </>
  )
}
