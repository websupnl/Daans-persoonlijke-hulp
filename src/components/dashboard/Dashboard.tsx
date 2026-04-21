'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import AppDetailDrawer, { DetailField } from '@/components/ui/AppDetailDrawer'
import { formatCurrency } from '@/lib/utils'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EuroIcon from '@mui/icons-material/Euro'
import CalendarIcon from '@mui/icons-material/CalendarMonth'
import WarningIcon from '@mui/icons-material/ReportProblem'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

interface DashboardData {
  stats: {
    todos: { total: number; open: number; dueToday: number; overdue: number }
    finance: { openInvoices: number; openAmount: number; monthIncome: number; monthExpenses: number }
  }
  urgentTodos: Array<{ id: number; title: string; priority: string; due_date?: string | null; project_title?: string }>
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

type SelectedDetail =
  | { kind: 'todo'; title: string; href: string; fields: DetailField[]; status?: string }
  | { kind: 'event'; title: string; href: string; fields: DetailField[]; status?: string }
  | { kind: 'finance'; title: string; href: string; fields: DetailField[]; status?: string }

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function firstInsight(text?: string | null) {
  if (!text) return 'Je dashboard wordt bijgewerkt. Focus eerst op wat vandaag aandacht vraagt.'
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/^(.+?[.!?])\s/)
  return (match?.[1] || cleaned).slice(0, 180)
}

function compactDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Vandaag'
  if (date.toDateString() === yesterday.toDateString()) return 'Gisteren'
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(date)
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const [dashboardRes, eventRes, summaryRes] = await Promise.all([
        fetch('/api/dashboard').then((r) => r.json()),
        fetch(`/api/events?date=${today}`).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dashboard' }),
        }).then((r) => r.json()).catch(() => ({ summary: null })),
      ])
      setData(dashboardRes)
      setEvents((eventRes.data || []).filter((e: EventItem) => e.date === today).slice(0, 5))
      setAiSummary(summaryRes.summary)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  return (
    <PageShell
      title={`${greeting()}, Daan.`}
      subtitle={new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
      actions={
        <IconButton onClick={loadData} size="small" aria-label="Dashboard vernieuwen" disabled={loading}>
          <RefreshIcon />
        </IconButton>
      }
    >
      <Stack spacing={3}>
        <AIBriefing
          title="Dagbrief"
          briefing={firstInsight(aiSummary)}
          score={data?.stats.todos.overdue === 0 ? 95 : 70}
          loading={loading && !aiSummary}
          compact
        />

        {loading && !data ? (
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map((item) => (
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={item}>
                <Skeleton variant="rounded" height={88} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <ModuleStats stats={[
            { icon: <CheckCircleIcon />, label: 'Taken', value: data?.stats.todos.open || 0, helper: `${data?.stats.todos.dueToday || 0} voor vandaag`, accent: 'brand' },
            { icon: <WarningIcon />, label: 'Over datum', value: data?.stats.todos.overdue || 0, helper: 'Directe actie nodig', tone: (data?.stats.todos.overdue || 0) > 0 ? 'error' : 'default' },
            { icon: <EuroIcon />, label: 'Uitgaven', value: formatCurrency(data?.stats.finance.monthExpenses || 0), helper: 'Deze maand' },
            { icon: <CalendarIcon />, label: 'Agenda', value: events.length, helper: 'Afspraken vandaag', tone: 'good' },
          ]} />
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              <Paper sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 850 }}>Focus taken</Typography>
                  <Button component="a" href="/todos" size="small" endIcon={<ArrowForwardIcon />}>Bekijk alles</Button>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Taak</TableCell>
                      <TableCell align="right">Prioriteit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading && !data ? [1, 2, 3].map((item) => (
                      <TableRow key={item}>
                        <TableCell><Skeleton width="80%" /></TableCell>
                        <TableCell align="right"><Skeleton width={72} sx={{ ml: 'auto' }} /></TableCell>
                      </TableRow>
                    )) : (data?.urgentTodos || []).slice(0, 5).map((todo) => (
                      <TableRow
                        key={todo.id}
                        hover
                        onClick={() => setSelectedDetail({
                          kind: 'todo',
                          title: todo.title,
                          href: '/todos',
                          status: todo.priority,
                          fields: [
                            { label: 'Prioriteit', value: todo.priority },
                            { label: 'Deadline', value: compactDate(todo.due_date) },
                            { label: 'Project', value: todo.project_title || 'Geen project' },
                          ],
                        })}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 750, whiteSpace: 'normal' }}>{todo.title}</Typography></TableCell>
                        <TableCell align="right">
                          <Chip label={todo.priority} size="small" variant="outlined" color={todo.priority === 'hoog' ? 'error' : 'default'} sx={{ fontSize: 10, fontWeight: 800 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>

              <Paper sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 850 }}>Recente uitgaven</Typography>
                  <Button component="a" href="/finance" size="small" endIcon={<ArrowForwardIcon />}>Bekijk transacties</Button>
                </Box>
                <Table size="small">
                  <TableBody>
                    {loading && !data ? [1, 2, 3].map((item) => (
                      <TableRow key={item}>
                        <TableCell><Skeleton width="75%" /></TableCell>
                        <TableCell align="right"><Skeleton width={72} sx={{ ml: 'auto' }} /></TableCell>
                      </TableRow>
                    )) : (data?.recentFinance || []).slice(0, 5).map((financeItem) => (
                      <TableRow
                        key={financeItem.id}
                        hover
                        onClick={() => setSelectedDetail({
                          kind: 'finance',
                          title: financeItem.title,
                          href: '/finance',
                          status: financeItem.type,
                          fields: [
                            { label: 'Bedrag', value: `${financeItem.type === 'inkomst' ? '+' : '-'}${formatCurrency(financeItem.amount)}` },
                            { label: 'Datum', value: compactDate(financeItem.created_at) },
                            { label: 'Categorie', value: financeItem.category },
                          ],
                        })}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 750, whiteSpace: 'normal' }}>{financeItem.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{compactDate(financeItem.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 800, color: financeItem.type === 'inkomst' ? 'success.main' : 'text.primary' }}>
                            {financeItem.type === 'inkomst' ? '+' : '-'}{formatCurrency(financeItem.amount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper sx={{ height: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Agenda vandaag</Typography>
                <Button component="a" href="/agenda" size="small">Bekijk afspraken</Button>
              </Box>
              <Stack spacing={0} sx={{ p: 0 }}>
                {loading && !data ? [1, 2, 3].map((item) => (
                  <Box key={item} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Skeleton width="30%" />
                    <Skeleton width="75%" />
                  </Box>
                )) : events.map((event) => (
                  <Box
                    key={event.id}
                    onClick={() => setSelectedDetail({
                      kind: 'event',
                      title: event.title,
                      href: '/agenda',
                      status: event.time || 'Hele dag',
                      fields: [
                        { label: 'Datum', value: event.date },
                        { label: 'Tijd', value: event.time || 'Hele dag' },
                        { label: 'Type', value: event.type || '-' },
                      ],
                    })}
                    sx={{ p: 2, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}
                  >
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>{event.time || 'Hele dag'}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{event.title}</Typography>
                  </Box>
                ))}
                {!loading && events.length === 0 && (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Geen afspraken vandaag.</Typography>
                  </Box>
                )}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>

      <AppDetailDrawer
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        eyebrow="Details"
        title={selectedDetail?.title}
        status={selectedDetail?.status}
        fields={selectedDetail?.fields}
        primaryHref={selectedDetail?.href}
        primaryLabel="Open module"
      />
    </PageShell>
  )
}
