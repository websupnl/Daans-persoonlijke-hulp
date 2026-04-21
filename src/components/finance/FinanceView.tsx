'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ActionSearchBar, type Action } from '@/components/ui/action-search-bar'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ButtonGroup from '@mui/material/ButtonGroup'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AlertTriangle from '@mui/icons-material/ReportProblem'
import Euro from '@mui/icons-material/Euro'
import Plus from '@mui/icons-material/Add'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import MoreHorizontal from '@mui/icons-material/MoreHoriz'
import Sparkles from '@mui/icons-material/AutoAwesome'
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

const TYPE_FILTERS = ['Alles', 'Inkomsten', 'Uitgaven'] as const
const ACCOUNT_FILTERS = ['Alle rekeningen', 'Prive', 'Zakelijk', 'Spaar Prive', 'Spaar Zakelijk'] as const
const ACCOUNT_VALUES: Record<string, string | null> = {
  'Alle rekeningen': null,
  Prive: 'privé',
  Zakelijk: 'zakelijk',
  'Spaar Prive': 'spaar-privé',
  'Spaar Zakelijk': 'spaar-zakelijk',
}
const VIEW_MODES = ['day', 'week', 'month'] as const

function accountLabel(account: string) {
  if (account === 'privé') return 'Prive'
  if (account === 'spaar-privé') return 'Spaar Prive'
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
  const [balances, setBalances] = useState<Balance[]>([])
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('Alles')
  const [accountFilter, setAccountFilter] = useState<(typeof ACCOUNT_FILTERS)[number]>('Alle rekeningen')
  const [viewMode, setViewMode] = useState<(typeof VIEW_MODES)[number]>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [tabValue, setTabValue] = useState(0)

  const [selectedTransaction, setSelectedTransaction] = useState<FinanceItem | null>(null)
  const [showAdd, setShowAdd] = useState(false)

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

    try {
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
      setBalances(balanceResponse.data || [])
    } catch (error) {
      console.error('Failed to fetch finance data:', error)
    } finally {
      setLoading(false)
    }
  }, [accountFilter, dateRange.end, dateRange.start, typeFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const [aiSummary, setAiSummary] = useState<string | null>(null)
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
    if (payload.data) {
      setSelectedTransaction(payload.data)
    }
    fetchData()
  }

  const net = (stats?.month_income || 0) - (stats?.month_expenses || 0)
  const currentBalance = balances.reduce((sum, balance) => sum + (Number(balance.balance) || 0), 0) || 0

  const columns: GridColDef[] = [
    { 
      field: 'due_date', 
      headerName: 'Datum', 
      width: 120,
      valueGetter: (params, row) => row.due_date || row.created_at,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" color="text.secondary">
          {format(new Date(params.value), 'd MMM yyyy', { locale: nl })}
        </Typography>
      )
    },
    { field: 'title', headerName: 'Omschrijving', flex: 1, minWidth: 200 },
    { 
      field: 'account', 
      headerName: 'Rekening', 
      width: 140,
      renderCell: (params: GridRenderCellParams) => accountLabel(params.value)
    },
    { field: 'category', headerName: 'Categorie', width: 140 },
    { 
      field: 'amount', 
      headerName: 'Bedrag', 
      width: 120, 
      align: 'right', 
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams) => (
        <Typography 
          variant="body2" 
          fontWeight={800} 
          color={params.row.type === 'inkomst' ? 'success.main' : 'secondary.main'}
        >
          {params.row.type === 'inkomst' ? '+' : '-'}{formatCurrency(params.value)}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ height: '100%' }}>
          <AIContextButton type="finance" title={params.row.title} content={params.row.user_notes} id={params.row.id} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedTransaction(params.row) }}>
            <MoreHorizontal fontSize="small" />
          </IconButton>
        </Stack>
      )
    }
  ]

  const searchActions = useMemo<Action[]>(
    () => [
      {
        id: 'command:new-transaction',
        label: 'Nieuwe transactie',
        icon: <Plus />,
        description: 'Nieuwe regel toevoegen',
        end: 'Command',
      },
      ...items.slice(0, 12).map((item) => ({
        id: `transaction:${item.id}`,
        label: item.title,
        icon: <Euro />,
        description: `${accountLabel(item.account)} · ${item.category}`,
        end: formatCurrency(item.amount),
      })),
    ],
    [items]
  )

  return (
    <>
      <PageShell
        title="Financiën"
        subtitle={`${periodLabel(viewMode, currentDate)} · Overzicht van je inkomsten en uitgaven`}
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ButtonGroup size="small">
              {VIEW_MODES.map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'contained' : 'outlined'}
                  onClick={() => setViewMode(mode)}
                  sx={{ fontWeight: 700 }}
                >
                  {mode === 'day' ? 'Dag' : mode === 'week' ? 'Week' : 'Maand'}
                </Button>
              ))}
            </ButtonGroup>
            <Stack direction="row" spacing={0.5}>
              <IconButton 
                size="small" 
                onClick={() => {
                  if (viewMode === 'day') setCurrentDate((prev) => addDays(prev, -1))
                  else if (viewMode === 'week') setCurrentDate((prev) => addWeeks(prev, -1))
                  else setCurrentDate((prev) => addMonths(prev, -1))
                }}
              >
                <ChevronLeft />
              </IconButton>
              <Button size="small" variant="outlined" onClick={() => setCurrentDate(new Date())} sx={{ minWidth: 140, fontWeight: 700 }}>
                {periodLabel(viewMode, currentDate)}
              </Button>
              <IconButton 
                size="small" 
                onClick={() => {
                  if (viewMode === 'day') setCurrentDate((prev) => addDays(prev, 1))
                  else if (viewMode === 'week') setCurrentDate((prev) => addWeeks(prev, 1))
                  else setCurrentDate((prev) => addMonths(prev, 1))
                }}
              >
                <ChevronRight />
              </IconButton>
            </Stack>
            <Button variant="contained" startIcon={<Plus />} onClick={() => setShowAdd(true)} sx={{ borderRadius: 99, px: 3 }}>
              Nieuw
            </Button>
          </Stack>
        }
      >
        <Stack spacing={3}>
          <AIBriefing 
            title="Geld Briefing"
            briefing={aiSummary || "Bezig met analyseren van je financiële stromen..."}
            score={net >= 0 ? 85 : 40}
          />

          <ModuleStats stats={[
            { icon: <Euro />, label: 'Saldo', value: formatCurrency(currentBalance), helper: `${balances.length} rekeningen`, accent: 'brand' },
            { icon: <TrendingUpIcon />, label: 'Netto', value: formatCurrency(net), helper: `${formatCurrency(stats?.month_income || 0)} in / ${formatCurrency(stats?.month_expenses || 0)} uit`, tone: net >= 0 ? 'good' : 'error' },
            { icon: <AlertTriangle />, label: 'Openstaand', value: formatCurrency(stats?.open_amount || 0), helper: `${stats?.open_count || 0} facturen`, tone: (stats?.open_count || 0) > 0 ? 'warn' : 'default' },
            { icon: <Sparkles />, label: 'Inzicht', value: categoryStats.length, helper: 'Actieve categorieën', tone: 'good' },
          ]} />

          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
                <Tab label="Transacties" sx={{ fontWeight: 800, py: 2 }} />
                <Tab label="Analyse" sx={{ fontWeight: 800, py: 2 }} />
                <Tab label="Instellingen" sx={{ fontWeight: 800, py: 2 }} />
              </Tabs>
            </Box>

            <Box sx={{ p: 2 }}>
              {tabValue === 0 && (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1}>
                      {TYPE_FILTERS.map(f => (
                        <Chip 
                          key={f} 
                          label={f} 
                          onClick={() => setTypeFilter(f)}
                          variant={typeFilter === f ? 'filled' : 'outlined'}
                          color={typeFilter === f ? 'primary' : 'default'}
                          size="small"
                        />
                      ))}
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      {ACCOUNT_FILTERS.slice(0, 3).map(f => (
                        <Button 
                          key={f} 
                          size="small"
                          onClick={() => setAccountFilter(f)}
                          variant={accountFilter === f ? 'contained' : 'outlined'}
                          sx={{ fontWeight: 700 }}
                        >
                          {f}
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
                      initialState={{
                        pagination: { paginationModel: { pageSize: 25 } },
                      }}
                      disableRowSelectionOnClick
                      onRowClick={(params) => setSelectedTransaction(params.row as FinanceItem)}
                      sx={{ 
                        border: 'none',
                        '& .MuiDataGrid-cell:focus': { outline: 'none' }
                      }}
                    />
                  </Box>
                </Stack>
              )}
            </Box>
          </Box>
        </Stack>
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
