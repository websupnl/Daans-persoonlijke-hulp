'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'
import AIContextButton from '@/components/ai/AIContextButton'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import LoadingButton from '@/components/ui/LoadingButton'
import { Spinner } from '@/components/ui/spinner'
import { formatDate, isOverdue } from '@/lib/utils'
import Plus from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import Sparkles from '@mui/icons-material/AutoAwesome'
import ListIcon from '@mui/icons-material/List'

interface Todo {
  id: number
  title: string
  description?: string
  category: string
  priority: 'hoog' | 'medium' | 'laag'
  due_date?: string
  completed: boolean
  project_title?: string
  project_color?: string
}

const FILTERS = ['Alles', 'Vandaag', 'Deze week', 'Te laat', 'Afgerond'] as const
const CATEGORIES = ['alles', 'werk', 'financieel', 'gezondheid', 'persoonlijk', 'studie', 'overig'] as const

export default function TodosView() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Alles')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('alles')
  const [loading, setLoading] = useState(true)
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [busyTodoId, setBusyTodoId] = useState<number | null>(null)
  const [newTodo, setNewTodo] = useState({ title: '', description: '', category: 'overig', priority: 'medium', due_date: '' })

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter === 'Vandaag') params.set('filter', 'today')
    else if (filter === 'Deze week') params.set('filter', 'week')
    else if (filter === 'Te laat') params.set('filter', 'overdue')
    else if (filter === 'Afgerond') params.set('completed', '1')
    if (category !== 'alles') params.set('category', category)

    try {
      const response = await fetch(`/api/todos?${params}`)
      const payload = await response.json()
      setTodos(payload.data || [])
    } catch (error) {
      console.error('Failed to fetch todos:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, category])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  useEffect(() => {
    fetch('/api/todos/recommend')
      .then(res => res.json())
      .then(data => setRecommendation(data.recommendation))
      .catch(() => {})
  }, [])

  async function toggleTodo(id: number, completed: boolean) {
    setBusyTodoId(id)
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      })
      setTodos((current) => current.map((todo) => todo.id === id ? { ...todo, completed: !completed } : todo))
      setSelectedTodo((current) => current?.id === id ? { ...current, completed: !completed } : current)
      fetchTodos()
    } finally {
      setBusyTodoId(null)
    }
  }

  async function moveTodoToDone(id: number) {
    const todo = todos.find((item) => item.id === id)
    if (!todo) return
    await toggleTodo(id, todo.completed)
  }

  async function createTodo() {
    if (!newTodo.title.trim() || creating) return
    setCreating(true)
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTodo,
          title: newTodo.title.trim(),
          due_date: newTodo.due_date || null,
        }),
      })
      const payload = await response.json()
      if (payload.data) {
        setTodos((current) => [payload.data, ...current])
        setSelectedTodo(payload.data)
      }
      setNewTodo({ title: '', description: '', category: 'overig', priority: 'medium', due_date: '' })
      setShowAdd(false)
      fetchTodos()
    } finally {
      setCreating(false)
    }
  }

  async function updateTodo(id: number, values: Record<string, string | number | boolean | null>) {
    setSavingDetail(true)
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, due_date: values.due_date || null }),
      })
      const payload = await response.json()
      if (payload.data) {
        setSelectedTodo(payload.data)
        setTodos((current) => current.map((todo) => todo.id === id ? { ...todo, ...payload.data } : todo))
      }
      fetchTodos()
    } finally {
      setSavingDetail(false)
    }
  }

  const openTodos = todos.filter((todo) => !todo.completed)
  const completedCount = todos.filter((todo) => todo.completed).length
  const overdueCount = todos.filter((todo) => !todo.completed && isOverdue(todo.due_date)).length
  const todayCount = todos.filter((todo) => !todo.completed && formatDate(todo.due_date) === 'Vandaag').length

  const columns: GridColDef[] = [
    {
      field: 'completed',
      headerName: '',
      width: 50,
      renderCell: (params: GridRenderCellParams) => (
        <IconButton 
          size="small" 
          onClick={(e) => { e.stopPropagation(); toggleTodo(params.row.id, params.value) }}
          color={params.value ? 'success' : 'default'}
          disabled={busyTodoId === params.row.id}
        >
          {busyTodoId === params.row.id ? <Spinner className="h-4 w-4" /> : params.value ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
        </IconButton>
      )
    },
    { 
      field: 'title', 
      headerName: 'Taak', 
      flex: 1,
      renderCell: (params: GridRenderCellParams) => (
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 700,
            whiteSpace: 'normal',
            lineHeight: 1.45,
            textDecoration: params.row.completed ? 'line-through' : 'none',
            color: params.row.completed ? 'text.secondary' : 'text.primary'
          }}
        >
          {params.value}
        </Typography>
      )
    },
    {
      field: 'priority',
      headerName: 'Prioriteit',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value} 
          size="small" 
          variant="outlined"
          color={params.value === 'hoog' ? 'error' : params.value === 'medium' ? 'warning' : 'default'}
          sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 10 }}
        />
      )
    },
    { 
      field: 'category', 
      headerName: 'Categorie', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'capitalize' }}>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'due_date',
      headerName: 'Deadline',
      width: 140,
      renderCell: (params: GridRenderCellParams) => (
        <Typography 
          variant="caption" 
          sx={{ 
            fontWeight: 700, 
            color: isOverdue(params.value) && !params.row.completed ? 'error.main' : 'text.secondary' 
          }}
        >
          {params.value ? formatDate(params.value) : '-'}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: '',
      width: 58,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ height: '100%' }}>
          <AIContextButton type="todo" title={params.row.title} id={params.row.id} />
        </Stack>
      )
    }
  ]

  return (
    <>
      <PageShell
        title="Taken"
        subtitle={`${openTodos.length} openstaande taken · Focus op wat nu moet`}
        actions={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="outlined" startIcon={<Plus />} onClick={() => setShowAdd(true)} sx={{ borderRadius: 99, px: 3 }}>
              Nieuwe taak
            </Button>
          </Stack>
        }
      >
        <Stack spacing={3}>
          {showAdd && (
            <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack component="form" spacing={1.5} onSubmit={(event) => { event.preventDefault(); createTodo() }}>
                <Typography variant="h6" sx={{ fontWeight: 850 }}>Nieuwe taak</Typography>
                <TextField label="Taak" value={newTodo.title} onChange={(event) => setNewTodo((current) => ({ ...current, title: event.target.value }))} autoFocus fullWidth />
                <TextField label="Omschrijving" value={newTodo.description} onChange={(event) => setNewTodo((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} fullWidth />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField select label="Prioriteit" value={newTodo.priority} onChange={(event) => setNewTodo((current) => ({ ...current, priority: event.target.value }))} fullWidth>
                    {['laag', 'medium', 'hoog'].map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}
                  </TextField>
                  <TextField label="Deadline" type="date" value={newTodo.due_date} onChange={(event) => setNewTodo((current) => ({ ...current, due_date: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                </Stack>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" onClick={() => setShowAdd(false)} disabled={creating}>Annuleer</Button>
                  <LoadingButton type="submit" variant="contained" loading={creating} loadingText="Toevoegen..." disabled={!newTodo.title.trim()}>
                    Toevoegen
                  </LoadingButton>
                </Stack>
              </Stack>
            </Paper>
          )}

          <AIBriefing 
            title="AI Focus Advies"
            briefing={recommendation || "Je takenlijst ziet er hanteerbaar uit. Geen directe actie vereist."}
            score={overdueCount > 0 ? 45 : 90}
            scoreLabel="/100"
            compact
          />

          <ModuleStats stats={[
            { icon: <ListIcon />, label: 'Open', value: openTodos.length, helper: 'Taken te gaan', accent: 'brand' },
            { icon: <Sparkles />, label: 'Vandaag', value: todayCount, helper: 'Voor vandaag gepland', tone: todayCount > 0 ? 'warn' : 'default' },
            { icon: <CheckCircleIcon />, label: 'Klaar', value: completedCount, helper: 'Afgerond deze periode', tone: 'good' },
            { icon: <RadioButtonUncheckedIcon />, label: 'Te laat', value: overdueCount, helper: 'Deadline verstreken', tone: overdueCount > 0 ? 'error' : 'default' },
          ]} />

          <Box sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tabs value={filter} onChange={(_, v) => setFilter(v)}>
                {FILTERS.map(f => (
                  <Tab key={f} label={f} value={f} sx={{ fontWeight: 800, py: 2 }} />
                ))}
              </Tabs>
              
              <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
                {CATEGORIES.slice(0, 5).map(cat => (
                  <Chip 
                    key={cat} 
                    label={cat} 
                    onClick={() => setCategory(cat)}
                    variant={category === cat ? 'filled' : 'outlined'}
                    color={category === cat ? 'primary' : 'default'}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ height: 600, width: '100%' }}>
              <DataGrid
                rows={todos}
                columns={columns}
                loading={loading}
                getRowHeight={() => 'auto'}
                disableRowSelectionOnClick
                onRowClick={(params) => setSelectedTodo(params.row as Todo)}
                sx={{ 
                  border: 'none',
                  '& .MuiDataGrid-cell': { py: 1.25, alignItems: 'center' },
                  '& .MuiDataGrid-cell:focus': { outline: 'none' }
                }}
              />
            </Box>
          </Box>
        </Stack>
      </PageShell>

      <AppDetailDrawer
        open={!!selectedTodo}
        onClose={() => setSelectedTodo(null)}
        eyebrow="Taak"
        title={selectedTodo?.title}
        subtitle={selectedTodo?.description || 'Geen omschrijving beschikbaar.'}
        status={selectedTodo?.completed ? 'Afgerond' : selectedTodo?.priority}
        fields={[
          { label: 'Categorie', value: selectedTodo?.category },
          { label: 'Deadline', value: selectedTodo?.due_date ? formatDate(selectedTodo.due_date) : 'Geen datum' },
          { label: 'Project', value: selectedTodo?.project_title || 'Geen project' },
          { label: 'Status', value: selectedTodo?.completed ? 'Voltooid' : 'Open' },
        ]}
        editableFields={selectedTodo ? [
          { name: 'title', label: 'Taak', value: selectedTodo.title, type: 'text' },
          { name: 'description', label: 'Omschrijving', value: selectedTodo.description || '', type: 'textarea' },
          { name: 'priority', label: 'Prioriteit', value: selectedTodo.priority, type: 'select', options: ['laag', 'medium', 'hoog'].map((value) => ({ label: value, value })) },
          { name: 'category', label: 'Categorie', value: selectedTodo.category || 'overig', type: 'select', options: CATEGORIES.filter((value) => value !== 'alles').map((value) => ({ label: value, value })) },
          { name: 'due_date', label: 'Deadline', value: selectedTodo.due_date || '', type: 'date' },
        ] : []}
        onSave={(values) => selectedTodo ? updateTodo(selectedTodo.id, values) : undefined}
        saving={savingDetail}
        actions={selectedTodo ? [
          {
            label: selectedTodo.completed ? 'Heropenen' : 'Voltooien',
            variant: 'contained',
            loading: busyTodoId === selectedTodo.id,
            onClick: () => toggleTodo(selectedTodo.id, selectedTodo.completed),
          },
          {
            label: 'Verplaats naar afgerond',
            variant: 'outlined',
            loading: busyTodoId === selectedTodo.id,
            disabled: selectedTodo.completed,
            onClick: () => moveTodoToDone(selectedTodo.id),
          },
        ] : []}
      />
      <FloatingActionButton label="Nieuwe taak" onClick={() => setShowAdd(true)} />
    </>
  )
}
