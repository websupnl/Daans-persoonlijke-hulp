'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { ActionSearchBar, type Action } from '@/components/ui/action-search-bar'
import PageShell from '@/components/ui/PageShell'
import AIBriefing from '@/components/ui/AIBriefing'
import ModuleStats from '@/components/ui/ModuleStats'
import AppDetailDrawer from '@/components/ui/AppDetailDrawer'
import AIContextButton from '@/components/ai/AIContextButton'
import { cn, formatDate, isOverdue } from '@/lib/utils'
import Plus from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import Sparkles from '@mui/icons-material/AutoAwesome'
import ListIcon from '@mui/icons-material/List'
import GridIcon from '@mui/icons-material/GridView'

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
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    })
    fetchTodos()
  }

  async function deleteTodo(id: number) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' })
    fetchTodos()
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
        >
          {params.value ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
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
      field: 'project_title',
      headerName: 'Project',
      width: 150,
      renderCell: (params: GridRenderCellParams) => params.value ? (
        <Chip 
          label={params.value} 
          size="small"
          sx={{ 
            height: 20,
            fontSize: 10,
            fontWeight: 800,
            bgcolor: `${params.row.project_color || '#5a677b'}18`,
            color: params.row.project_color || '#5a677b',
            border: 'none'
          }}
        />
      ) : null
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" sx={{ height: '100%' }}>
          <AIContextButton type="todo" title={params.row.title} id={params.row.id} />
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteTodo(params.row.id) }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
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
            <Button variant="contained" startIcon={<Plus />} onClick={() => setShowAdd(true)} sx={{ borderRadius: 99, px: 3 }}>
              Nieuwe taak
            </Button>
          </Stack>
        }
      >
        <Stack spacing={3}>
          <AIBriefing 
            title="AI Focus Advies"
            briefing={recommendation || "Je takenlijst ziet er hanteerbaar uit. Geen directe actie vereist."}
            score={overdueCount > 0 ? 45 : 90}
            scoreLabel="/100"
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
                disableRowSelectionOnClick
                onRowClick={(params) => setSelectedTodo(params.row as Todo)}
                sx={{ 
                  border: 'none',
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
        actions={selectedTodo ? [
          {
            label: selectedTodo.completed ? 'Heropenen' : 'Voltooien',
            variant: 'contained',
            onClick: () => toggleTodo(selectedTodo.id, selectedTodo.completed),
          },
          {
            label: 'Verwijderen',
            variant: 'outlined',
            onClick: () => deleteTodo(selectedTodo.id),
          },
        ] : []}
      />
    </>
  )
}
