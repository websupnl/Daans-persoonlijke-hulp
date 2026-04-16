'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Trash2, Calendar, LayoutGrid, ListTodo } from 'lucide-react'
import { cn, formatDate, isOverdue, PRIORITY_COLORS } from '@/lib/utils'

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
const CATEGORIES = ['alles', 'overig', 'werk', 'financieel', 'gezondheid', 'persoonlijk', 'studie'] as const
const PIPELINE = [
  { key: 'hoog', label: 'Nu eerst', hint: 'Hoge prioriteit' },
  { key: 'today', label: 'Vandaag', hint: 'Deadline vandaag' },
  { key: 'planned', label: 'Gepland', hint: 'Komt eraan' },
  { key: 'later', label: 'Later', hint: 'Rustiger tempo' },
] as const

type Filter = typeof FILTERS[number]
type Category = typeof CATEGORIES[number]
type ViewMode = 'list' | 'board'

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function TodosView() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('Alles')
  const [category, setCategory] = useState<Category>('alles')
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [loadingRecommendation, setLoadingRecommendation] = useState(false)
  const [newTodo, setNewTodo] = useState({ title: '', priority: 'medium', category: 'overig', due_date: '' })

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter === 'Vandaag') params.set('filter', 'today')
    else if (filter === 'Deze week') params.set('filter', 'week')
    else if (filter === 'Te laat') params.set('filter', 'overdue')
    else if (filter === 'Afgerond') params.set('completed', '1')
    if (category !== 'alles') params.set('category', category)

    const res = await fetch(`/api/todos?${params}`)
    const data = await res.json()
    setTodos(data.data || [])
    setLoading(false)
  }, [filter, category])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  async function addTodo() {
    if (!newTodo.title.trim()) return
    await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTodo),
    })
    setNewTodo({ title: '', priority: 'medium', category: 'overig', due_date: '' })
    setShowAdd(false)
    fetchTodos()
  }

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

  async function getRecommendation() {
    setLoadingRecommendation(true)
    setRecommendation(null)
    try {
      const res = await fetch('/api/todos/recommend')
      const data = await res.json()
      setRecommendation(data.recommendation)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRecommendation(false)
    }
  }

  async function moveTodo(id: number, column: typeof PIPELINE[number]['key']) {
    const payload: Record<string, string | null> = {}

    if (column === 'hoog') {
      payload.priority = 'hoog'
    } else if (column === 'today') {
      payload.priority = 'medium'
      payload.due_date = new Date().toISOString().split('T')[0]
    } else if (column === 'planned') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      payload.priority = 'medium'
      payload.due_date = tomorrow.toISOString().split('T')[0]
    } else if (column === 'later') {
      payload.priority = 'laag'
      payload.due_date = null
    }

    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    fetchTodos()
  }

  const openCount = todos.filter((t) => !t.completed).length
  const overdueCount = todos.filter((t) => !t.completed && isOverdue(t.due_date)).length
  const todayCount = todos.filter((t) => !t.completed && formatDate(t.due_date) === 'Vandaag').length

  const boardColumns = {
    hoog: todos.filter((t) => !t.completed && t.priority === 'hoog'),
    today: todos.filter((t) => !t.completed && formatDate(t.due_date) === 'Vandaag' && t.priority !== 'hoog'),
    planned: todos.filter((t) => !t.completed && !!t.due_date && formatDate(t.due_date) !== 'Vandaag' && !isOverdue(t.due_date) && t.priority !== 'hoog'),
    later: todos.filter((t) => !t.completed && !t.due_date && t.priority !== 'hoog'),
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-gradient">Todos</h1>
            <p className="mt-1 text-xs font-medium text-gray-400">
              {openCount} open, {todayCount} vandaag, {overdueCount} te laat
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setViewMode('board')}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-all', viewMode === 'board' ? 'text-white shadow-sm' : 'text-gray-500')}
                style={viewMode === 'board' ? { background: GRAD } : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <LayoutGrid size={12} />
                  Board
                </span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-all', viewMode === 'list' ? 'text-white shadow-sm' : 'text-gray-500')}
                style={viewMode === 'list' ? { background: GRAD } : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <ListTodo size={12} />
                  Lijst
                </span>
              </button>
            </div>

            <button
              onClick={getRecommendation}
              disabled={loadingRecommendation}
              className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-600 shadow-sm transition-all hover:bg-orange-100 disabled:opacity-50"
            >
              <LayoutGrid size={14} />
              {loadingRecommendation ? 'Denken...' : 'Wat moet ik nu doen?'}
            </button>

            <button
              onClick={() => setShowAdd((s) => !s)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
              style={{ background: GRAD }}
            >
              <Plus size={14} />
              Toevoegen
            </button>
          </div>
        </div>
      </div>

      {recommendation && (
        <div className="mx-6 mt-4 rounded-3xl border border-orange-100 bg-orange-50/50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <LayoutGrid size={16} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">AI Aanbeveling</p>
              <p className="mt-1 text-sm font-medium text-gray-700">{recommendation}</p>
            </div>
            <button 
              onClick={() => setRecommendation(null)}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <Plus size={16} className="rotate-45" />
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="mx-6 mt-4 rounded-3xl border border-gray-200 bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
          <input
            autoFocus
            value={newTodo.title}
            onChange={(e) => setNewTodo((p) => ({ ...p, title: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Wat moet er gebeuren?"
            className="mb-3 w-full border-b border-white/80 bg-transparent pb-2 text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={newTodo.priority}
              onChange={(e) => setNewTodo((p) => ({ ...p, priority: e.target.value }))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none"
            >
              <option value="hoog">Hoog</option>
              <option value="medium">Medium</option>
              <option value="laag">Laag</option>
            </select>
            <select
              value={newTodo.category}
              onChange={(e) => setNewTodo((p) => ({ ...p, category: e.target.value }))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none"
            >
              {CATEGORIES.filter((c) => c !== 'alles').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              value={newTodo.due_date}
              onChange={(e) => setNewTodo((p) => ({ ...p, due_date: e.target.value }))}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 outline-none"
            />
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700">Annuleer</button>
              <button onClick={addTodo} className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm" style={{ background: GRAD }}>Opslaan</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 pt-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-all', filter === f ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100')}
              style={filter === f ? { background: GRAD } : undefined}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 pb-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={cn('rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all', category === item ? 'border-transparent text-white shadow-sm' : 'border-gray-200 text-gray-500 hover:border-pink-200 hover:text-gray-700')}
              style={category === item ? { background: GRAD } : undefined}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : todos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50/60 px-6 py-12 text-center">
            <p className="text-sm font-medium text-gray-400">Geen todos gevonden voor deze selectie.</p>
          </div>
        ) : viewMode === 'board' && filter !== 'Afgerond' ? (
          <div className="grid gap-4 xl:grid-cols-4">
            {PIPELINE.map((column) => (
              <div
                key={column.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const todoId = Number(event.dataTransfer.getData('text/plain'))
                  if (todoId) moveTodo(todoId, column.key)
                }}
                className="rounded-3xl border border-gray-100 bg-gray-50/60 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700">{column.label}</p>
                    <p className="text-[11px] text-gray-400">{column.hint}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-500 shadow-sm">
                    {boardColumns[column.key].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {boardColumns[column.key].length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-5 text-center text-[11px] text-gray-350">
                      Leeg
                    </div>
                  ) : (
                    boardColumns[column.key].map((todo) => (
                      <TodoCard key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {todos.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TodoCard({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo
  onToggle: (id: number, completed: boolean) => void
  onDelete: (id: number) => void
}) {
  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', String(todo.id))}
      className="group rounded-2xl border border-white bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-2 flex items-start gap-2">
        <button
          onClick={() => onToggle(todo.id, todo.completed)}
          className={cn('mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all', todo.completed ? 'border-transparent' : 'border-gray-300 hover:border-pink-400')}
          style={todo.completed ? { background: GRAD } : undefined}
        >
          {todo.completed && <Check size={11} className="text-white" strokeWidth={3} />}
        </button>
        <p className={cn('flex-1 text-sm font-semibold', todo.completed ? 'text-gray-400 line-through' : 'text-gray-700')}>
          {todo.title}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-7">
        <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[todo.priority])}>
          {todo.priority}
        </span>
        <span className="text-[10px] text-gray-400">{todo.category}</span>
        {todo.due_date && (
          <span className={cn('flex items-center gap-1 text-[10px] font-medium', isOverdue(todo.due_date) && !todo.completed ? 'text-red-400' : 'text-gray-400')}>
            <Calendar size={9} />
            {formatDate(todo.due_date)}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(todo.id)}
        className="mt-3 flex items-center gap-1 pl-7 text-[11px] font-medium text-gray-300 transition-colors hover:text-red-400"
      >
        <Trash2 size={11} />
        Verwijderen
      </button>
    </div>
  )
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo
  onToggle: (id: number, completed: boolean) => void
  onDelete: (id: number) => void
}) {
  return (
    <div className={cn('group flex items-start gap-3 rounded-2xl border border-gray-100 p-3 transition-all hover:bg-gray-50', todo.completed && 'opacity-50')}>
      <button
        onClick={() => onToggle(todo.id, todo.completed)}
        className={cn('mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all', todo.completed ? 'border-transparent' : 'border-gray-300 hover:border-pink-400')}
        style={todo.completed ? { background: GRAD } : undefined}
      >
        {todo.completed && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', todo.completed ? 'text-gray-400 line-through' : 'text-gray-700')}>
          {todo.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-medium', PRIORITY_COLORS[todo.priority])}>
            {todo.priority}
          </span>
          <span className="text-[10px] text-gray-400">{todo.category}</span>
          {todo.due_date && (
            <span className={cn('flex items-center gap-1 text-[10px] font-medium', isOverdue(todo.due_date) && !todo.completed ? 'text-red-400' : 'text-gray-400')}>
              <Calendar size={9} />
              {formatDate(todo.due_date)}
            </span>
          )}
          {todo.project_title && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${todo.project_color}18`, color: todo.project_color }}>
              {todo.project_title}
            </span>
          )}
        </div>
      </div>

      <button onClick={() => onDelete(todo.id)} className="p-1 text-gray-300 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100">
        <Trash2 size={13} />
      </button>
    </div>
  )
}
