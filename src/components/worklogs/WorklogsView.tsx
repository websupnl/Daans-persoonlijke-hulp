'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'
import AIContextButton from '@/components/ai/AIContextButton'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import LoadingButton from '@/components/ui/LoadingButton'
import {
  addDays,
  format,
  isToday,
  isYesterday,
  startOfDay,
} from 'date-fns'
import { nl } from 'date-fns/locale'
import ClockIcon from '@mui/icons-material/AccessTime'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import TimerIcon from '@mui/icons-material/Timer'
import BoltIcon from '@mui/icons-material/Bolt'

interface WorkLog {
  id: number
  date: string
  context: string
  project_title?: string
  title: string
  description?: string
  duration_minutes: number
  actual_duration_minutes?: number
  energy_level?: number
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}u`
  return `${h}u ${m}m`
}

export default function WorklogsView() {
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [savingLog, setSavingLog] = useState(false)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [activeTimer, setActiveTimer] = useState<{ title: string; context: string; elapsed_minutes: number } | null>(null)
  const [timerTitle, setTimerTitle] = useState('')
  const [timerBusy, setTimerBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    try {
      const response = await fetch(`/api/worklogs?date=${dateStr}`)
      const data = await response.json()
      const timerData = await fetch('/api/timers').then((res) => res.json()).catch(() => ({ timer: null }))
      setLogs(data.logs || [])
      setTodayMinutes(data.todayStats?.today_minutes ?? 0)
      setWeekMinutes(data.weekStats?.week_minutes ?? 0)
      setActiveTimer(timerData.timer || null)
    } catch (error) {
      console.error('Failed to load worklogs:', error)
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'worklogs' }),
    })
      .then((r) => r.json())
      .then((d) => setAiSummary(d.summary ?? null))
      .catch(() => {})
  }, [])

  async function handleDelete(id: number) {
    await fetch(`/api/worklogs/${id}`, { method: 'DELETE' })
    setSelectedLog(null)
    load()
  }

  async function createManualLog(values: Record<string, string | number | boolean | null>) {
    setSavingLog(true)
    try {
      await fetch('/api/worklogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title || 'Werkregistratie',
          description: values.description || null,
          date: values.date || format(currentDate, 'yyyy-MM-dd'),
          context: values.context || 'werk',
          duration_minutes: Number(values.duration_minutes || 30),
          actual_duration_minutes: Number(values.duration_minutes || 30),
          energy_level: values.energy_level ? Number(values.energy_level) : null,
          source: 'manual',
        }),
      })
      setManualOpen(false)
      await load()
    } finally {
      setSavingLog(false)
    }
  }

  async function updateSelectedLog(values: Record<string, string | number | boolean | null>) {
    if (!selectedLog) return
    setSavingLog(true)
    try {
      const response = await fetch(`/api/worklogs/${selectedLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          date: values.date,
          context: values.context,
          duration_minutes: Number(values.duration_minutes || selectedLog.duration_minutes),
          actual_duration_minutes: Number(values.duration_minutes || selectedLog.actual_duration_minutes || selectedLog.duration_minutes),
          energy_level: values.energy_level ? Number(values.energy_level) : null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (payload?.data) setSelectedLog(payload.data as WorkLog)
      await load()
    } finally {
      setSavingLog(false)
    }
  }

  async function startTimer() {
    const title = timerTitle.trim() || 'Werkblok'
    setTimerBusy(true)
    try {
      await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', title, context: 'werk' }),
      })
      setTimerTitle('')
      await load()
    } finally {
      setTimerBusy(false)
    }
  }

  async function stopTimer() {
    setTimerBusy(true)
    try {
      await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      await load()
    } finally {
      setTimerBusy(false)
    }
  }

  const dateLabel = useMemo(() => {
    if (isToday(currentDate)) return 'Vandaag'
    if (isYesterday(currentDate)) return 'Gisteren'
    return format(currentDate, 'EEEE d MMMM', { locale: nl })
  }, [currentDate])

  const columns: GridColDef[] = [
    { 
      field: 'title', 
      headerName: 'Activiteit', 
      flex: 1,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{params.value}</Typography>
          {params.row.description && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {params.row.description}
            </Typography>
          )}
        </Box>
      )
    },
    { 
      field: 'context', 
      headerName: 'Context', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip label={params.value} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: 10 }} />
      )
    },
    { 
      field: 'project_title', 
      headerName: 'Project', 
      width: 150,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="caption" color="text.secondary">{params.value || '-'}</Typography>
      )
    },
    { 
      field: 'duration_minutes', 
      headerName: 'Duur', 
      width: 100,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {formatDuration(params.row.actual_duration_minutes || params.value)}
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
          <AIContextButton type="worklog" title={params.row.title} id={params.row.id} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(params.row.id) }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      )
    }
  ]

  return (
    <>
      <PageShell
        title="Werklog"
        subtitle="Registratie van je uren en focus"
        actions={
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              background: 'linear-gradient(90deg, rgba(168,206,207,0.3), rgba(230,174,140,0.22))',
              boxShadow: '0 12px 28px -24px rgba(15,15,16,0.5)',
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center">
              <IconButton size="medium" onClick={() => setCurrentDate(prev => addDays(prev, -1))}>
                <ChevronLeft />
              </IconButton>
              <Button 
                size="medium"
                variant="contained"
                onClick={() => setCurrentDate(new Date())}
                sx={{
                  minWidth: { xs: 136, sm: 170 },
                  fontWeight: 900,
                  bgcolor: 'background.paper',
                  color: 'text.primary',
                  backgroundImage: 'none',
                  '&:hover': { bgcolor: 'background.paper', backgroundImage: 'none' },
                }}
              >
                {dateLabel}
              </Button>
              <IconButton size="medium" onClick={() => setCurrentDate(prev => addDays(prev, 1))}>
                <ChevronRight />
              </IconButton>
            </Stack>
          </Box>
        }
      >
        <Stack spacing={3}>
          <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Timer</Typography>
                <Typography variant="body2" color="text.secondary">
                  {activeTimer ? `${activeTimer.title} loopt ${formatDuration(activeTimer.elapsed_minutes)}` : 'Start een werksessie en stop hem om automatisch te loggen.'}
                </Typography>
              </Box>
              {activeTimer ? (
                <LoadingButton variant="contained" onClick={stopTimer} loading={timerBusy} loadingText="Stoppen...">
                  Stop timer
                </LoadingButton>
              ) : (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ width: { xs: '100%', md: 560 }, flexShrink: 0 }}
                >
                  <TextField
                    label="Waar werk je aan?"
                    value={timerTitle}
                    onChange={(event) => setTimerTitle(event.target.value)}
                    placeholder="Bijv. offerte Bouma of klantwebsite"
                    fullWidth
                  />
                  <LoadingButton
                    variant="contained"
                    onClick={startTimer}
                    loading={timerBusy}
                    loadingText="Starten..."
                    sx={{ minWidth: { sm: 120 } }}
                  >
                    Start
                  </LoadingButton>
                </Stack>
              )}
            </Stack>
          </Paper>

          <AIBriefing 
            title="Werk & Focus Briefing"
            briefing={aiSummary || "Analyse van je werkpatronen wordt geladen..."}
            score={weekMinutes > 2000 ? 85 : 65}
            compact
          />

          <ModuleStats stats={[
            { icon: <ClockIcon />, label: 'Vandaag', value: formatDuration(todayMinutes), helper: 'Totaal gelogd', accent: 'brand' },
            { icon: <TimerIcon />, label: 'Deze week', value: formatDuration(weekMinutes), helper: 'Totaal gewerkt', tone: 'default' },
            { icon: <BoltIcon />, label: 'Productiviteit', value: '8.4', helper: 'Gemiddelde score', tone: 'good' },
            { icon: <ClockIcon />, label: 'Sessies', value: logs.length, helper: 'Logs vandaag', tone: 'default' },
          ]} />

          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ height: 500, width: '100%' }}>
              <DataGrid
                rows={logs}
                columns={columns}
                loading={loading}
                disableRowSelectionOnClick
                onRowClick={(params) => setSelectedLog(params.row as WorkLog)}
                sx={{ border: 'none' }}
              />
            </Box>
          </Box>
        </Stack>
      </PageShell>

      <AppDetailDrawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        eyebrow="Werklog"
        title={selectedLog?.title}
        subtitle={selectedLog?.description || 'Geen extra details.'}
        status={selectedLog?.context}
        fields={[
          { label: 'Datum', value: selectedLog?.date ? format(new Date(selectedLog.date), 'd MMM yyyy') : '-' },
          { label: 'Duur', value: formatDuration(selectedLog?.duration_minutes) },
          { label: 'Project', value: selectedLog?.project_title || '-' },
          { label: 'Energie', value: selectedLog?.energy_level ? `${selectedLog.energy_level}/10` : '-' },
        ]}
        editableFields={[
          { name: 'title', label: 'Waar werkte je aan?', value: selectedLog?.title || '', type: 'text' },
          { name: 'description', label: 'Notitie', value: selectedLog?.description || '', type: 'textarea' },
          { name: 'date', label: 'Datum', value: selectedLog?.date ? format(new Date(selectedLog.date), 'yyyy-MM-dd') : format(currentDate, 'yyyy-MM-dd'), type: 'date' },
          {
            name: 'context',
            label: 'Context',
            value: selectedLog?.context || 'werk',
            type: 'select',
            options: [
              { label: 'Werk', value: 'werk' },
              { label: 'WebsUp', value: 'websup' },
              { label: 'Bouma', value: 'bouma' },
              { label: 'Prive', value: 'prive' },
              { label: 'Overig', value: 'overig' },
            ],
          },
          { name: 'duration_minutes', label: 'Duur in minuten', value: selectedLog?.actual_duration_minutes || selectedLog?.duration_minutes || 30, type: 'number' },
          { name: 'energy_level', label: 'Energie 1-10', value: selectedLog?.energy_level || '', type: 'number' },
        ]}
        onSave={updateSelectedLog}
        saving={savingLog}
        saveLabel="Werklog opslaan"
        actions={selectedLog ? [
          { label: 'Verwijderen', variant: 'outlined', onClick: () => handleDelete(selectedLog.id) },
        ] : []}
      />

      <AppDetailDrawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        eyebrow="Nieuwe registratie"
        title="Werkregistratie toevoegen"
        subtitle="Leg handmatig vast wat je hebt gedaan."
        status={format(currentDate, 'd MMM yyyy', { locale: nl })}
        editableFields={[
          { name: 'title', label: 'Waar werkte je aan?', value: '', type: 'text' },
          { name: 'description', label: 'Notitie', value: '', type: 'textarea' },
          { name: 'date', label: 'Datum', value: format(currentDate, 'yyyy-MM-dd'), type: 'date' },
          {
            name: 'context',
            label: 'Context',
            value: 'werk',
            type: 'select',
            options: [
              { label: 'Werk', value: 'werk' },
              { label: 'WebsUp', value: 'websup' },
              { label: 'Bouma', value: 'bouma' },
              { label: 'Prive', value: 'prive' },
              { label: 'Overig', value: 'overig' },
            ],
          },
          { name: 'duration_minutes', label: 'Duur in minuten', value: 30, type: 'number' },
          { name: 'energy_level', label: 'Energie 1-10', value: '', type: 'number' },
        ]}
        onSave={createManualLog}
        saving={savingLog}
        saveLabel="Registratie opslaan"
        defaultEditing
      />

      <FloatingActionButton label="Nieuwe werkregistratie" onClick={() => setManualOpen(true)} />
    </>
  )
}
