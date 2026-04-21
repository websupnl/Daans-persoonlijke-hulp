'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
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
import IconButton from '@mui/material/IconButton'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import AppDetailDrawer, { DetailField } from '@/components/ui/AppDetailDrawer'
import { formatCurrency, formatRelative } from '@/lib/utils'
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
        fetch('/api/dashboard').then(r => r.json()),
        fetch(`/api/events?date=${today}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dashboard' }),
        }).then(r => r.json()).catch(() => ({ summary: null }))
      ])
      setData(dashboardRes)
      setEvents((eventRes.data || []).filter((e: any) => e.date === today).slice(0, 5))
      setAiSummary(summaryRes.summary)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  if (loading && !data) {
    return (
      <PageShell title="Laden..." subtitle="Je dashboard wordt voorbereid">
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={120} />
          <Grid container spacing={2}>
            {[1, 2, 3, 4].map(i => <Grid item xs={12} sm={6} lg={3} key={i}><Skeleton variant="rounded" height={100} /></Grid>)}
          </Grid>
          <Skeleton variant="rounded" height={400} />
        </Stack>
      </PageShell>
    )
  }

  return (
    <PageShell
      title={`${greeting()}, Daan.`}
      subtitle={new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
      actions={
        <IconButton onClick={loadData} size="small">
          <RefreshIcon />
        </IconButton>
      }
    >
      <Stack spacing={3}>
        <AIBriefing 
          title="Dag Briefing"
          briefing={aiSummary || "Je data wordt geanalyseerd voor een persoonlijk overzicht..."}
          score={data?.stats.todos.overdue === 0 ? 95 : 70}
        />

        <ModuleStats stats={[
          { icon: <CheckCircleIcon />, label: 'Taken', value: data?.stats.todos.open || 0, helper: `${data?.stats.todos.dueToday || 0} voor vandaag`, accent: 'brand' },
          { icon: <WarningIcon />, label: 'Over datum', value: data?.stats.todos.overdue || 0, helper: 'Directe actie nodig', tone: (data?.stats.todos.overdue || 0) > 0 ? 'error' : 'default' },
          { icon: <EuroIcon />, label: 'Uitgaven', value: formatCurrency(data?.stats.finance.monthExpenses || 0), helper: 'Deze maand', tone: 'default' },
          { icon: <CalendarIcon />, label: 'Agenda', value: events.length, helper: 'Afspraken vandaag', tone: 'good' },
        ]} />

        <Grid container spacing={3}>
          {/* Linker kolom: Taken & Transacties */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              <Paper sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 850 }}>Focus taken</Typography>
                  <Button component={Link} href="/todos" size="small" endIcon={<ArrowForwardIcon />}>Lijst</Button>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Taak</TableCell>
                      <TableCell>Prioriteit</TableCell>
                      <TableCell>Project</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.urgentTodos || []).slice(0, 5).map((todo) => (
                      <TableRow key={todo.id} hover sx={{ cursor: 'pointer' }}>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{todo.title}</Typography></TableCell>
                        <TableCell>
                          <Chip label={todo.priority} size="small" variant="outlined" color={todo.priority === 'hoog' ? 'error' : 'default'} sx={{ fontSize: 10, fontWeight: 800 }} />
                        </TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary">{todo.project_title || '-'}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>

              <Paper sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="h6" sx={{ fontWeight: 850 }}>Recente uitgaven</Typography>
                  <Button component={Link} href="/finance" size="small" endIcon={<ArrowForwardIcon />}>Financiën</Button>
                </Box>
                <Table size="small">
                  <TableBody>
                    {(data?.recentFinance || []).slice(0, 5).map((f) => (
                      <TableRow key={f.id} hover sx={{ cursor: 'pointer' }}>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 700 }}>{f.title}</Typography></TableCell>
                        <TableCell><Chip label={f.category} size="small" variant="outlined" sx={{ fontSize: 10 }} /></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 800, color: f.type === 'inkomst' ? 'success.main' : 'text.primary' }}>
                            {f.type === 'inkomst' ? '+' : '-'}{formatCurrency(f.amount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          </Grid>

          {/* Rechter kolom: Agenda */}
          <Grid item xs={12} lg={4}>
            <Paper sx={{ height: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Agenda vandaag</Typography>
                <Button component={Link} href="/agenda" size="small">Bekijk</Button>
              </Box>
              <Stack spacing={0} sx={{ p: 0 }}>
                {events.map((e) => (
                  <Box key={e.id} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>{e.time || 'Hele dag'}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{e.title}</Typography>
                  </Box>
                ))}
                {events.length === 0 && (
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
        fields={selectedDetail?.fields}
        primaryHref={selectedDetail?.href}
      />
    </PageShell>
  )
}
