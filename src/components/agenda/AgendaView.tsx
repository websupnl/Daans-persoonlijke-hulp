'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Grid from '@mui/material/Grid'
import ButtonGroup from '@mui/material/ButtonGroup'
import TextField from '@mui/material/TextField'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import LoadingButton from '@/components/ui/LoadingButton'
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns'
import { nl } from 'date-fns/locale'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import PlusIcon from '@mui/icons-material/Add'
import CalendarIcon from '@mui/icons-material/CalendarMonth'
import EventIcon from '@mui/icons-material/Event'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocationOnIcon from '@mui/icons-material/LocationOn'

interface AgendaEvent {
  id: number
  title: string
  description?: string
  date?: string
  time?: string
  duration?: number
  type?: string
  start_time: string
  end_time: string
  location?: string
  category?: string
  is_all_day: boolean
  all_day?: number | boolean
  color?: string
}

function eventStart(event: AgendaEvent) {
  if (event.start_time) return new Date(event.start_time)
  return new Date(`${event.date || new Date().toISOString().split('T')[0]}T${event.time || '00:00'}`)
}

function eventEnd(event: AgendaEvent) {
  if (event.end_time) return new Date(event.end_time)
  const start = eventStart(event)
  return new Date(start.getTime() + (event.duration || 60) * 60000)
}

export default function AgendaView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), time: '', duration: 60, type: 'algemeen' })

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const from = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const to = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
    try {
      const response = await fetch(`/api/events?from=${from}&to=${to}`)
      const data = await response.json()
      setEvents(data.data || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [currentMonth])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'agenda' }),
    })
      .then((r) => r.json())
      .then((d) => setAiSummary(d.summary ?? null))
      .catch(() => {})
  }, [])

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const dayEvents = useMemo(() => {
    return events.filter(e => isSameDay(eventStart(e), selectedDate))
  }, [events, selectedDate])

  async function createEvent() {
    if (!newEvent.title.trim()) return
    setSaving(true)
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      })
      setNewEvent({ title: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), time: '', duration: 60, type: 'algemeen' })
      setShowAdd(false)
      await fetchEvents()
    } finally {
      setSaving(false)
    }
  }

  async function updateEvent(values: Record<string, string | number | boolean | null>) {
    if (!selectedEvent) return
    setSaving(true)
    try {
      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload = await response.json()
      if (payload.data) setSelectedEvent(payload.data)
      await fetchEvents()
    } finally {
      setSaving(false)
    }
  }

  const columns: GridColDef[] = [
    { 
      field: 'time', 
      headerName: 'Tijd', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {params.row.is_all_day || params.row.all_day ? 'Hele dag' : format(eventStart(params.row), 'HH:mm')}
        </Typography>
      )
    },
    { 
      field: 'title', 
      headerName: 'Afspraak', 
      flex: 1,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{params.value}</Typography>
          {params.row.location && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocationOnIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">{params.row.location}</Typography>
            </Stack>
          )}
        </Box>
      )
    },
    { 
      field: 'category', 
      headerName: 'Categorie', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => params.value ? (
        <Chip label={params.value} size="small" variant="outlined" sx={{ fontSize: 10, fontWeight: 700 }} />
      ) : '-'
    }
  ]

  return (
    <PageShell
      title="Agenda"
      subtitle={`${format(currentMonth, 'MMMM yyyy', { locale: nl })} · Je planning en afspraken`}
      actions={
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ButtonGroup size="small">
            <Button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft /></Button>
            <Button onClick={() => setCurrentMonth(new Date())} sx={{ fontWeight: 700 }}>Vandaag</Button>
            <Button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight /></Button>
          </ButtonGroup>
          <Button variant="outlined" startIcon={<PlusIcon />} onClick={() => setShowAdd(true)} sx={{ borderRadius: 99 }}>
            Afspraak
          </Button>
        </Stack>
      }
    >
      <Stack spacing={3}>
        {showAdd && (
          <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Stack component="form" spacing={1.5} onSubmit={(event) => { event.preventDefault(); createEvent() }}>
              <Typography variant="h6" sx={{ fontWeight: 850 }}>Nieuwe afspraak</Typography>
              <TextField label="Titel" value={newEvent.title} onChange={(event) => setNewEvent((current) => ({ ...current, title: event.target.value }))} autoFocus fullWidth />
              <TextField label="Omschrijving" value={newEvent.description} onChange={(event) => setNewEvent((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} fullWidth />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="Datum" type="date" value={newEvent.date} onChange={(event) => setNewEvent((current) => ({ ...current, date: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Tijd" type="time" value={newEvent.time} onChange={(event) => setNewEvent((current) => ({ ...current, time: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField label="Duur min." type="number" value={newEvent.duration} onChange={(event) => setNewEvent((current) => ({ ...current, duration: Number(event.target.value) }))} fullWidth />
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => setShowAdd(false)} disabled={saving}>Annuleer</Button>
                <LoadingButton type="submit" variant="contained" loading={saving} loadingText="Opslaan..." disabled={!newEvent.title.trim()}>
                  Opslaan
                </LoadingButton>
              </Stack>
            </Stack>
          </Paper>
        )}

        <AIBriefing 
          title="Agenda Briefing"
          briefing={aiSummary || "Je agenda wordt geanalyseerd for slimme inzichten..."}
          score={dayEvents.length > 5 ? 40 : 85}
          compact
        />

        <ModuleStats stats={[
          { icon: <EventIcon />, label: 'Vandaag', value: dayEvents.length, helper: 'Afspraken', accent: 'brand' },
          { icon: <AccessTimeIcon />, label: 'Vrije tijd', value: '4u', helper: 'Tussen afspraken', tone: 'good' },
          { icon: <CalendarIcon />, label: 'Deze week', value: events.length, helper: 'Totaal gepland', tone: 'default' },
          { icon: <LocationOnIcon />, label: 'Locaties', value: '2', helper: 'Reistijd nodig', tone: 'warn' },
        ]} />

        <Grid container spacing={3}>
          {/* Kalender sectie */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
                  <Typography key={d} variant="caption" align="center" sx={{ fontWeight: 800, color: 'text.secondary', py: 1 }}>
                    {d}
                  </Typography>
                ))}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {monthDays.map((day, idx) => {
                  const dayEventsCount = events.filter(e => isSameDay(eventStart(e), day)).length
                  const isSelected = isSameDay(day, selectedDate)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isTodayDay = isToday(day)

                  return (
                    <Box
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      sx={{
                        aspectRatio: '1/1',
                        borderRadius: 1,
                        p: 1,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : isTodayDay ? 'primary.light' : 'transparent',
                        bgcolor: isSelected ? 'primary.light' : 'transparent',
                        opacity: isCurrentMonth ? 1 : 0.3,
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: 'action.hover' },
                        position: 'relative'
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        align="center" 
                        sx={{ 
                          fontWeight: isSelected || isTodayDay ? 800 : 500,
                          color: isTodayDay ? 'primary.main' : 'text.primary'
                        }}
                      >
                        {format(day, 'd')}
                      </Typography>
                      {dayEventsCount > 0 && (
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          gap: 0.5, 
                          mt: 0.5,
                          flexWrap: 'wrap'
                        }}>
                          {Array.from({ length: Math.min(dayEventsCount, 3) }).map((_, i) => (
                            <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main' }} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Paper>
          </Grid>

          {/* Dag-overzicht sectie */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper sx={{ height: '100%', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>
                  {format(selectedDate, 'EEEE d MMMM', { locale: nl })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dayEvents.length} afspraken gepland
                </Typography>
              </Box>
              <Box sx={{ flex: 1, width: '100%' }}>
                <DataGrid
                  rows={dayEvents}
                  columns={columns}
                  hideFooter
                  disableRowSelectionOnClick
                  onRowClick={(params) => setSelectedEvent(params.row as AgendaEvent)}
                  sx={{ border: 'none' }}
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Stack>

      <AppDetailDrawer
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        eyebrow="Afspraak"
        title={selectedEvent?.title}
        subtitle={selectedEvent?.description || 'Geen omschrijving.'}
        status={selectedEvent?.category}
        fields={[
          { label: 'Tijd', value: selectedEvent ? `${format(eventStart(selectedEvent), 'HH:mm')} - ${format(eventEnd(selectedEvent), 'HH:mm')}` : '-' },
          { label: 'Locatie', value: selectedEvent?.location || '-' },
          { label: 'Type', value: selectedEvent?.is_all_day || selectedEvent?.all_day ? 'Hele dag' : selectedEvent?.type || selectedEvent?.category || 'Specifiek tijdstip' },
        ]}
        editableFields={selectedEvent ? [
          { name: 'title', label: 'Titel', value: selectedEvent.title, type: 'text' },
          { name: 'description', label: 'Omschrijving', value: selectedEvent.description || '', type: 'textarea' },
          { name: 'date', label: 'Datum', value: selectedEvent.date || format(eventStart(selectedEvent), 'yyyy-MM-dd'), type: 'date' },
          { name: 'time', label: 'Tijd', value: selectedEvent.time || format(eventStart(selectedEvent), 'HH:mm'), type: 'text' },
          { name: 'duration', label: 'Duur minuten', value: selectedEvent.duration || 60, type: 'number' },
          { name: 'type', label: 'Type', value: selectedEvent.type || selectedEvent.category || 'algemeen', type: 'text' },
        ] : []}
        onSave={updateEvent}
        saving={saving}
      />
      <FloatingActionButton label="Nieuwe afspraak" onClick={() => setShowAdd(true)} />
    </PageShell>
  )
}
