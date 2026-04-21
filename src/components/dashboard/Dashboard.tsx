'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Grid from '@mui/material/GridLegacy'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import EuroIcon from '@mui/icons-material/Euro'
import RefreshIcon from '@mui/icons-material/Refresh'
import { formatCurrency, formatRelative } from '@/lib/utils'

interface DashboardData {
  stats: {
    todos: { total: number; open: number; dueToday: number; overdue: number }
    finance: { openInvoices: number; openAmount: number; monthIncome: number; monthExpenses: number }
  }
  urgentTodos: Array<{ id: number; title: string; priority: string; due_date?: string; project_title?: string }>
  recentFinance: Array<{ id: number; title: string; amount: number; type: string; category: string; created_at: string }>
  inboxCount: number
}

interface EventItem {
  id: number
  title: string
  date: string
  time?: string | null
  type?: string
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function fallbackBriefing(data: DashboardData | null) {
  if (!data) return 'Je basisdata is geladen. De AI-briefing wordt op de achtergrond opgehaald.'
  const signals: string[] = []
  if (data.stats.todos.dueToday > 0) signals.push(`${data.stats.todos.dueToday} taken vragen vandaag aandacht`)
  if (data.stats.todos.overdue > 0) signals.push(`${data.stats.todos.overdue} taken zijn over datum`)
  if (data.stats.finance.monthExpenses > 0) signals.push(`uitgaven deze maand: ${formatCurrency(data.stats.finance.monthExpenses)}`)
  if (data.inboxCount > 0) signals.push(`${data.inboxCount} inbox-items wachten`)
  return signals.length ? signals.join(' · ') : 'Geen acute signalen. Kies bewust één focusblok voor vandaag.'
}

function priorityColor(priority: string): 'error' | 'warning' | 'success' | 'default' {
  if (priority === 'hoog') return 'error'
  if (priority === 'medium') return 'warning'
  if (priority === 'laag') return 'success'
  return 'default'
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  color = 'primary.main',
}: {
  label: string
  value: string | number
  helper: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <Paper sx={{ p: 2.25, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="overline" color="text.disabled">
            {label}
          </Typography>
          <Typography variant="h1" sx={{ mt: 0.5 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        </Box>
        <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: '#f4f4f5', color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </Box>
      </Stack>
    </Paper>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [baseLoading, setBaseLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)

  async function loadBase() {
    setBaseLoading(true)
    try {
      const [dashboardRes, eventRes] = await Promise.all([
        fetch('/api/dashboard').then((response) => response.json()),
        fetch(`/api/events?date=${new Date().toISOString().split('T')[0]}`).then((response) => response.json()).catch(() => ({ data: [] })),
      ])
      setData(dashboardRes)
      setEvents((eventRes.data || []).slice(0, 8))
    } finally {
      setBaseLoading(false)
    }
  }

  async function loadAiBriefing() {
    setAiLoading(true)
    try {
      const summaryRes = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'dashboard' }),
      }).then((response) => response.json())
      setAiSummary(summaryRes.summary ?? null)
    } catch {
      setAiSummary(null)
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    loadBase()
  }, [])

  useEffect(() => {
    if (!baseLoading) loadAiBriefing()
  }, [baseLoading])

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    []
  )

  if (baseLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={2.5}>
          <Skeleton variant="rounded" height={118} />
          <Grid container spacing={2}>
            {[0, 1, 2, 3].map((item) => (
              <Grid item xs={12} sm={6} lg={3} key={item}>
                <Skeleton variant="rounded" height={132} />
              </Grid>
            ))}
          </Grid>
          <Skeleton variant="rounded" height={360} />
        </Stack>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'stretch', md: 'flex-start' }}>
          <Box>
            <Typography variant="h1">{greeting()}, Daan.</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {dateLabel}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button component={Link} href="/chat" variant="contained" startIcon={<AutoAwesomeIcon />}>
              Vraag AI
            </Button>
            <IconButton onClick={() => { loadBase(); loadAiBriefing() }} aria-label="Vernieuw dashboard">
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Stack>

        <Paper
          sx={{
            p: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: 'secondary.main',
            borderRadius: 2,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f7ff 100%)',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AutoAwesomeIcon color="secondary" fontSize="small" />
                <Typography variant="overline" color="text.secondary">
                  AI briefing
                </Typography>
                {aiLoading && <Chip size="small" label="wordt bijgewerkt" color="secondary" variant="outlined" />}
              </Stack>
              <Typography variant="body1" sx={{ mt: 1, maxWidth: 980, lineHeight: 1.8 }}>
                {aiSummary ?? fallbackBriefing(data)}
              </Typography>
              {aiLoading && <LinearProgress color="secondary" sx={{ mt: 2, maxWidth: 360 }} />}
            </Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Button component={Link} href="/todos" variant="outlined" endIcon={<ArrowForwardIcon />}>
                Taken
              </Button>
              <Button component={Link} href="/finance" variant="outlined" endIcon={<ArrowForwardIcon />}>
                Financiën
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label="Open taken" value={data?.stats.todos.open ?? 0} helper={`${data?.stats.todos.dueToday ?? 0} vandaag`} icon={<CheckCircleOutlineIcon />} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label="Over datum" value={data?.stats.todos.overdue ?? 0} helper="Moet terug naar nul" color="error.main" icon={<CheckCircleOutlineIcon />} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label="Maanduitgaven" value={formatCurrency(data?.stats.finance.monthExpenses ?? 0)} helper="Deze maand" color="warning.main" icon={<EuroIcon />} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard label="Afspraken" value={events.length} helper="Vandaag gepland" color="info.main" icon={<CalendarMonthIcon />} />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
            <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, pb: 1 }}>
                <Box>
                  <Typography variant="h4">Focus taken</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tabelgericht overzicht van wat vandaag aandacht vraagt.
                  </Typography>
                </Box>
                <Button component={Link} href="/todos" size="small" endIcon={<ArrowForwardIcon />}>
                  Alles bekijken
                </Button>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Taak</TableCell>
                    <TableCell>Prioriteit</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Deadline</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.urgentTodos ?? []).slice(0, 8).map((todo) => (
                    <TableRow key={todo.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={750}>
                          {todo.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={todo.priority} color={priorityColor(todo.priority)} />
                      </TableCell>
                      <TableCell>{todo.project_title || '—'}</TableCell>
                      <TableCell>{todo.due_date || 'Geen'}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.urgentTodos ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          Geen focus taken voor vandaag.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          <Grid item xs={12} lg={5}>
            <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, pb: 1 }}>
                <Box>
                  <Typography variant="h4">Agenda vandaag</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Compact, scanbaar, zonder extra cards.
                  </Typography>
                </Box>
                <Button component={Link} href="/agenda" size="small" endIcon={<ArrowForwardIcon />}>
                  Agenda
                </Button>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tijd</TableCell>
                    <TableCell>Afspraak</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={`${event.id}-${event.date}-${event.time}`} hover>
                      <TableCell>{event.time || 'Hele dag'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={750}>
                          {event.title}
                        </Typography>
                      </TableCell>
                      <TableCell>{event.type || 'algemeen'}</TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          Geen afspraken vandaag.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>

        <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, pb: 1 }}>
            <Box>
              <Typography variant="h4">Recente transacties</Typography>
              <Typography variant="body2" color="text.secondary">
                Minder card design, meer helderheid in rijen en kolommen.
              </Typography>
            </Box>
            <Button component={Link} href="/finance" size="small" endIcon={<ArrowForwardIcon />}>
              Financiën
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Omschrijving</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell>Datum</TableCell>
                <TableCell align="right">Bedrag</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data?.recentFinance ?? []).map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={750}>
                      {item.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={item.category || 'overig'} variant="outlined" />
                  </TableCell>
                  <TableCell>{formatRelative(item.created_at)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={800} color={item.type === 'inkomst' ? 'success.main' : 'text.primary'}>
                      {item.type === 'inkomst' ? '+' : '-'}{formatCurrency(item.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {(data?.recentFinance ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      Nog geen recente transacties.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  )
}
