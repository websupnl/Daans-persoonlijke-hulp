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
import ActionFeedback from '@/components/ui/ActionFeedback'
import {
  addDays,
  format,
  isToday,
  isYesterday,
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
  start_time?: string | null
  end_time?: string | null
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

function minutesBetween(start?: string | null, end?: string | null, fallback = 30): number {
  if (!start || !end) return fallback
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return fallback
  const startTotal = startHour * 60 + startMinute
  let endTotal = endHour * 60 + endMinute
  if (endTotal <= startTotal) endTotal += 24 * 60
  return Math.max(1, endTotal - startTotal)
}

function addMinutesToTime(start: string, minutes: number) {
  const [hour, minute] = start.split(':').map(Number)
  const total = (hour * 60 + minute + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function normalizeDateInput(value?: string | null) {
  if (!value) return ''
  return String(value).split('T')[0]
}

function formatDateLabel(value?: string | null) {
  const date = normalizeDateInput(value)
  if (!date) return '-'
  return format(new Date(`${date}T12:00:00`), 'd MMM yyyy', { locale: nl })
}

function timeRangeLabel(start?: string | null, end?: string | null, minutes?: number | null) {
  if (start && end) return `${start} - ${end}`
  if (minutes) return formatDuration(minutes)
  return '-'
}

function formatLiveDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const h = Math.floor(safeSeconds / 3600)
  const m = Math.floor((safeSeconds % 3600) / 60)
  const s = safeSeconds % 60
  if (h > 0) return `${h}u ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function defaultTimeRange(minutes = 60) {
  const now = new Date()
  const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15
  const start = `${String(now.getHours()).padStart(2, '0')}:${String(roundedMinutes).padStart(2, '0')}`
  return { start, end: addMinutesToTime(start, minutes) }
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
  const [activeTimer, setActiveTimer] = useState<{ title: string; context: string; elapsed_minutes: number; started_at?: string } | null>(null)
  const [timerTitle, setTimerTitle] = useState('')
  const [timerBusy, setTimerBusy] = useState(false)
  const [timerError, setTimerError] = useState<string | null>(null)
  const [tick, setTick] = useState(Date.now())

  const load = useCallback(async () => {
    setLoading(true)
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    try {
      const response = await fetch(`/api/worklogs?date=${dateStr}`)
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error?.message || 'Werklogs konden niet worden opgehaald')
      }
      const data = payload?.data ?? payload ?? {}
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
    if (!activeTimer) return
    const interval = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [activeTimer])

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
      const date = String(values.date || format(currentDate, 'yyyy-MM-dd'))
      const duration = minutesBetween(String(values.start_time || ''), String(values.end_time || ''), 30)
      const response = await fetch('/api/worklogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title || 'Werkregistratie',
          description: values.description || null,
          date,
          context: values.context || 'werk',
          duration_minutes: duration,
          actual_duration_minutes: duration,
          start_time: values.start_time || null,
          end_time: values.end_time || null,
          energy_level: values.energy_level ? Number(values.energy_level) : null,
          source: 'manual',
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error?.message || payload?.message || 'Werkregistratie kon niet worden opgeslagen')
      }
      setManualOpen(false)
      if (date !== format(currentDate, 'yyyy-MM-dd')) {
        setCurrentDate(new Date(`${date}T12:00:00`))
      } else {
        await load()
      }
    } finally {
      setSavingLog(false)
    }
  }

  async function updateSelectedLog(values: Record<string, string | number | boolean | null>) {
    if (!selectedLog) return
    setSavingLog(true)
    try {
      const date = String(values.date || selectedLog.date)
      const duration = minutesBetween(String(values.start_time || ''), String(values.end_time || ''), selectedLog.duration_minutes)
      const response = await fetch(`/api/worklogs/${selectedLog.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title,
          description: values.description,
          date,
          context: values.context,
          duration_minutes: duration,
          actual_duration_minutes: duration,
          start_time: values.start_time || null,
          end_time: values.end_time || null,
          energy_level: values.energy_level ? Number(values.energy_level) : null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error?.message || payload?.message || 'Werklog kon niet worden opgeslagen')
      }
      if (payload?.data) setSelectedLog(payload.data as WorkLog)
      if (date !== format(currentDate, 'yyyy-MM-dd')) {
        setCurrentDate(new Date(`${date}T12:00:00`))
      } else {
        await load()
      }
    } finally {
      setSavingLog(false)
    }
  }

  async function startTimer() {
    const title = timerTitle.trim() || 'Werkblok'
    setTimerBusy(true)
    setTimerError(null)
    try {
      const response = await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', title, context: 'werk' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Timer starten is niet gelukt')
      setTimerTitle('')
      await load()
    } catch (error) {
      setTimerError(error instanceof Error ? error.message : 'Timer starten is niet gelukt')
    } finally {
      setTimerBusy(false)
    }
  }

  async function stopTimer() {
    setTimerBusy(true)
    setTimerError(null)
    try {
      const response = await fetch('/api/timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Timer stoppen is niet gelukt')
      await load()
    } catch (error) {
      setTimerError(error instanceof Error ? error.message : 'Timer stoppen is niet gelukt')
    } finally {
      setTimerBusy(false)
    }
  }

  const dateLabel = useMemo(() => {
    if (isToday(currentDate)) return 'Vandaag'
    if (isYesterday(currentDate)) return 'Gisteren'
    return format(currentDate, 'EEEE d MMMM', { locale: nl })
  }, [currentDate])

  const liveTimerSeconds = useMemo(() => {
    if (!activeTimer) return 0
    if (!activeTimer.started_at) return (activeTimer.elapsed_minutes || 0) * 60
    return Math.max(0, Math.floor((tick - new Date(activeTimer.started_at).getTime()) / 1000))
  }, [activeTimer, tick])

  const manualTimeRange = useMemo(() => defaultTimeRange(60), [manualOpen])
  const selectedTimeRange = useMemo(() => {
    const start = selectedLog?.start_time || '09:00'
    return {
      start,
      end: selectedLog?.end_time || addMinutesToTime(start, selectedLog?.actual_duration_minutes || selectedLog?.duration_minutes || 30),
    }
  }, [selectedLog])

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
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>
            {formatDuration(params.row.actual_duration_minutes || params.value)}
          </Typography>
          {(params.row.start_time || params.row.end_time) && (
            <Typography variant="caption" color="text.secondary">
              {timeRangeLabel(params.row.start_time, params.row.end_time)}
            </Typography>
          )}
        </Box>
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
          <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden', position: 'relative' }}>
            {activeTimer && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, rgba(168,206,207,0.18), rgba(230,174,140,0.14), rgba(168,206,207,0.18))',
                  backgroundSize: '200% 100%',
                  animation: 'timerPulse 2.8s ease-in-out infinite',
                  '@keyframes timerPulse': {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                  },
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                }}
              />
            )}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: 1,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'common.white',
                      background: 'var(--brand-gradient)',
                      boxShadow: activeTimer ? '0 0 0 6px rgba(95,159,161,0.12)' : 'none',
                      transform: activeTimer ? 'translateZ(0)' : 'none',
                      animation: activeTimer ? 'timerIconBeat 1.8s ease-in-out infinite' : 'none',
                      '@keyframes timerIconBeat': {
                        '0%, 100%': { boxShadow: '0 0 0 5px rgba(95,159,161,0.12)' },
                        '50%': { boxShadow: '0 0 0 9px rgba(230,174,140,0.18)' },
                      },
                      '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none',
                      },
                    }}
                  >
                    <TimerIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 850 }}>Timer</Typography>
                    {activeTimer && (
                      <Typography variant="h3" sx={{ fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                        {formatLiveDuration(liveTimerSeconds)}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                  {activeTimer && (
                    <Box
                      aria-hidden
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        animation: 'timerDot 1.2s ease-in-out infinite',
                        '@keyframes timerDot': {
                          '0%, 100%': { opacity: 0.45, transform: 'scale(0.88)' },
                          '50%': { opacity: 1, transform: 'scale(1)' },
                        },
                        '@media (prefers-reduced-motion: reduce)': {
                          animation: 'none',
                          opacity: 1,
                        },
                      }}
                    />
                  )}
                  <Typography variant="body2" color="text.secondary">
                    {activeTimer ? `${activeTimer.title} loopt nu actief.` : 'Start een werksessie en stop hem om automatisch te loggen.'}
                  </Typography>
                </Stack>
              </Box>
              {activeTimer ? (
                <LoadingButton variant="contained" onClick={stopTimer} loading={timerBusy} loadingText="Stoppen..." sx={{ position: 'relative', zIndex: 1 }}>
                  Stop timer
                </LoadingButton>
              ) : (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ width: { xs: '100%', md: 560 }, flexShrink: 0, position: 'relative', zIndex: 1 }}
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
            {timerError && (
              <Box sx={{ mt: 1.5, position: 'relative', zIndex: 1 }}>
                <ActionFeedback tone="error" title="Timeractie mislukt" message={timerError} />
              </Box>
            )}
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
                slots={{ noRowsOverlay: WorklogEmptyOverlay }}
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
          { label: 'Datum', value: formatDateLabel(selectedLog?.date) },
          { label: 'Tijd', value: timeRangeLabel(selectedLog?.start_time, selectedLog?.end_time, selectedLog?.actual_duration_minutes || selectedLog?.duration_minutes) },
          { label: 'Duur', value: formatDuration(selectedLog?.actual_duration_minutes || selectedLog?.duration_minutes) },
          { label: 'Project', value: selectedLog?.project_title || '-' },
          { label: 'Energie', value: selectedLog?.energy_level ? `${selectedLog.energy_level}/10` : '-' },
        ]}
        editableFields={[
          { name: 'title', label: 'Waar werkte je aan?', value: selectedLog?.title || '', type: 'text' },
          { name: 'description', label: 'Notitie', value: selectedLog?.description || '', type: 'textarea' },
          { name: 'date', label: 'Datum', value: normalizeDateInput(selectedLog?.date) || format(currentDate, 'yyyy-MM-dd'), type: 'date' },
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
          { name: 'start_time', label: 'Vanaf hoe laat?', value: selectedTimeRange.start, type: 'time' },
          { name: 'end_time', label: 'Tot hoe laat?', value: selectedTimeRange.end, type: 'time' },
          { name: 'energy_level', label: 'Energie 1-10', value: selectedLog?.energy_level || '', type: 'number' },
        ]}
        onSave={updateSelectedLog}
        saving={savingLog}
        saveLabel="Opslaan"
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
          { name: 'start_time', label: 'Vanaf hoe laat?', value: manualTimeRange.start, type: 'time' },
          { name: 'end_time', label: 'Tot hoe laat?', value: manualTimeRange.end, type: 'time' },
          { name: 'energy_level', label: 'Energie 1-10', value: '', type: 'number' },
        ]}
        onSave={createManualLog}
        saving={savingLog}
        saveLabel="Opslaan"
        defaultEditing
      />

      <FloatingActionButton label="Nieuwe werkregistratie" onClick={() => setManualOpen(true)} />
    </>
  )
}

function WorklogEmptyOverlay() {
  return (
    <Stack spacing={0.75} alignItems="center" justifyContent="center" sx={{ height: '100%', px: 2, textAlign: 'center' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>
        Nog geen werkregistraties
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
        Voeg handmatig een registratie toe of start de timer voor deze dag.
      </Typography>
    </Stack>
  )
}
