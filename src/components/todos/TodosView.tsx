'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  Check,
  LayoutGrid,
  ListTodo,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { cn, formatDate, isOverdue } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'
import { PriorityDot } from '@/components/ui/card'
import AIContextButton from '@/components/ai/AIContextButton'

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
const PIPELINE = [
  { key: 'hoog', label: 'Nu eerst' },
  { key: 'today', label: 'Vandaag' },
  { key: 'planned', label: 'Gepland' },
  { key: 'later', label: 'Later' },
] as const

type Filter = typeof FILTERS[number]
type Category = typeof CATEGORIES[number]
type ViewMode = 'list' | 'board'

function resolveBoardColumns(todos: Todo[]) {
  return {
    hoog: todos.filter((todo) => !todo.completed && todo.priority === 'hoog'),
    today: todos.filter((todo) => !todo.completed && formatDate(todo.due_date) === 'Vandaag' && todo.priority !== 'hoog'),
    planned: todos.filter((todo) => !todo.completed && !!todo.due_date && formatDate(todo.due_date) !== 'Vandaag' && !isOverdue(todo.due_date) && todo.priority !== 'hoog'),
    later: todos.filter((todo) => !todo.completed && !todo.due_date && todo.priority !== 'hoog'),
  }
}

export default function TodosView() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<Filter>('Alles')
  const [category, setCategory] = useState<Category>('alles')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [loadingRec, setLoadingRec] = useState(false)
  const [newTodo, setNewTodo] = useState({ title: '', priority: 'medium', category: 'overig', due_date: '' })

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter === 'Vandaag') params.set('filter', 'today')
    else if (filter === 'Deze week') params.set('filter', 'week')
    else if (filter === 'Te laat') params.set('filter', 'overdue')
    else if (filter === 'Afgerond') params.set('completed', '1')
    if (category !== 'alles') params.set('category', category)

    const response = await fetch(`/api/todos?${params}`)
    const payload = await response.json()
    setTodos(payload.data || [])
    setLoading(false)
  }, [filter, category])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

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

  async function getRecommendation() {
    setLoadingRec(true)
    setRecommendation(null)
    try {
      const response = await fetch('/api/todos/recommend')
      const payload = await response.json()
      setRecommendation(payload.recommendation)
    } finally {
      setLoadingRec(false)
    }
  }

  const openTodos = todos.filter((todo) => !todo.completed)
  const completedTodos = todos.filter((todo) => todo.completed)
  const overdueTodos = todos.filter((todo) => !todo.completed && isOverdue(todo.due_date))
  const todayTodos = todos.filter((todo) => !todo.completed && formatDate(todo.due_date) === 'Vandaag')
  const highPriorityTodos = todos.filter((todo) => !todo.completed && todo.priority === 'hoog')
  const boardColumns = resolveBoardColumns(todos)
  const nextUp = [...openTodos]
    .sort((left, right) => (left.due_date || '9999').localeCompare(right.due_date || '9999'))
    .slice(0, 5)

  return (
    <PageShell
      title="Todo's"
      subtitle={`${openTodos.length} open taken. Dit scherm moet helpen kiezen wat nu telt, niet alleen een lijst langer maken.`}
      actions={
        <>
          <div className="flex rounded-full border border-black/5 bg-white p-1">
            {(['list', 'board'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                  viewMode === mode ? 'bg-[#202625] text-white' : 'text-on-surface-variant hover:bg-surface-container-low'
                )}
              >
                {mode === 'list' ? <ListTodo size={15} /> : <LayoutGrid size={15} />}
              </button>
            ))}
          </div>
          <button
            onClick={getRecommendation}
            disabled={loadingRec}
            className="inline-flex items-center gap-2 rounded-lg border border-black/5 bg-white px-3.5 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:text-on-surface-variant"
          >
            {loadingRec ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Wat nu?
          </button>
          <button
            onClick={() => setShowAdd((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#202625] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
          >
            <Plus size={14} />
            Nieuwe todo
          </button>
        </>
      }
    >
      <StatStrip stats={[
        { label: 'Open', value: openTodos.length },
        { label: 'Vandaag', value: todayTodos.length, accent: todayTodos.length > 0 ? 'orange' : undefined },
        { label: 'Te laat', value: overdueTodos.length, accent: overdueTodos.length > 0 ? 'red' : undefined },
        { label: 'Afgerond', value: completedTodos.length, accent: 'green' },
      ]} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {showAdd && (
            <Panel tone="accent">
              <PanelHeader
                eyebrow="Nieuwe taak"
                title="Snel vastleggen"
                description="Vang eerst de taak af. Structuur mag helpen, maar mag het invoeren niet zwaarder maken."
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input
                  autoFocus
                  value={newTodo.title}
                  onChange={(event) => setNewTodo((current) => ({ ...current, title: event.target.value }))}
                  onKeyDown={(event) => event.key === 'Enter' && addTodo()}
                  placeholder="Wat moet er gebeuren?"
                  className="md:col-span-2 xl:col-span-2 rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                />
                <select
                  value={newTodo.priority}
                  onChange={(event) => setNewTodo((current) => ({ ...current, priority: event.target.value }))}
                  className="rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none"
                >
                  <option value="hoog">Hoog</option>
                  <option value="medium">Medium</option>
                  <option value="laag">Laag</option>
                </select>
                <select
                  value={newTodo.category}
                  onChange={(event) => setNewTodo((current) => ({ ...current, category: event.target.value }))}
                  className="rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none"
                >
                  {CATEGORIES.filter((item) => item !== 'alles').map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={newTodo.due_date}
                  onChange={(event) => setNewTodo((current) => ({ ...current, due_date: event.target.value }))}
                  className="rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={addTodo}
                  className="rounded-lg bg-[#202625] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                >
                  Opslaan
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-black/5 bg-white px-3.5 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  Annuleer
                </button>
              </div>
            </Panel>
          )}

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Filters"
              title="Scherp je lijst aan"
              description="Hoe minder ruis, hoe makkelijker kiezen. Filter op urgentie, tijd en context."
            />

            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      filter === item ? 'bg-[#202625] text-white' : 'bg-white text-on-surface-variant hover:bg-surface-container-low'
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((item) => (
                  <button
                    key={item}
                    onClick={() => setCategory(item)}
                    className={cn(
                      'rounded-full border border-black/5 px-3 py-1.5 text-xs font-medium transition-colors',
                      category === item ? 'bg-surface-container-high text-on-surface' : 'bg-white text-on-surface-variant hover:bg-surface-container-low'
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          {loading ? (
            <Panel className="min-h-[320px]">
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 size={22} className="animate-spin text-on-surface-variant" />
              </div>
            </Panel>
          ) : todos.length === 0 ? (
            <Panel>
              <EmptyPanel
                title="Geen taken gevonden"
                description="Dat is of heel goed, of je filters zijn te scherp. In beide gevallen hoort het scherm rustig en duidelijk te blijven."
              />
            </Panel>
          ) : viewMode === 'board' && filter !== 'Afgerond' ? (
            <div className="grid gap-3 xl:grid-cols-4">
              {PIPELINE.map((column) => (
                <Panel
                  key={column.key}
                  tone="muted"
                  className="p-4"
                >
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const id = Number(event.dataTransfer.getData('text/plain'))
                      if (id) moveTodo(id, column.key)
                    }}
                    className="min-h-[280px]"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <p className="text-sm font-headline font-bold text-on-surface">{column.label}</p>
                      <ActionPill>{boardColumns[column.key].length}</ActionPill>
                    </div>
                    <div className="space-y-3">
                      {boardColumns[column.key].length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-outline-variant/40 bg-white/55 px-4 py-10 text-center text-xs text-on-surface-variant">
                          Geen taken in deze kolom
                        </div>
                      ) : (
                        boardColumns[column.key].map((todo) => (
                          <TodoCard key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                        ))
                      )}
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel padding="sm">
              <PanelHeader
                eyebrow="Taken"
                title={filter === 'Afgerond' ? 'Afgeronde taken' : 'Actieve taken'}
                description="Een goede takenlijst laat in een oogopslag zien wat urgent is, wat context heeft en wat mag wachten."
                className="px-2 pb-2"
              />
              <div className="mt-2 space-y-1">
                {todos.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel tone={recommendation ? 'accent' : 'default'}>
            <PanelHeader
              eyebrow="AI focus"
              title="Wat nu?"
              description="De assistent hoort je te helpen kiezen, niet alleen nog een laag tekst bovenop de lijst te leggen."
            />

            <div className="mt-5">
              {recommendation ? (
                <p className="text-sm leading-7 text-on-surface">{recommendation}</p>
              ) : (
                <EmptyPanel
                  title="Nog geen advies opgehaald"
                  description="Vraag een aanbeveling als je veel open eindes hebt en even wilt forceren wat eerst moet."
                  action={
                    <button
                      onClick={getRecommendation}
                      disabled={loadingRec}
                      className="rounded-lg bg-[#202625] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
                    >
                      {loadingRec ? 'Bezig...' : 'Vraag advies'}
                    </button>
                  }
                />
              )}
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Kernsignalen"
              title="Waar de druk zit"
              description="Deze rail moet je helpen beoordelen of je lijst hanteerbaar is of uit de rails loopt."
            />

            <div className="mt-5 flex flex-wrap gap-2">
              <ActionPill>{highPriorityTodos.length} hoog</ActionPill>
              <ActionPill>{todayTodos.length} vandaag</ActionPill>
              <ActionPill>{overdueTodos.length} te laat</ActionPill>
            </div>

            <div className="mt-5 space-y-3">
              {nextUp.length === 0 ? (
                <EmptyPanel
                  title="Geen open taken"
                  description="Dat is precies de rust die je uiteindelijk wilt: geen verborgen werk meer dat in je hoofd blijft hangen."
                />
              ) : (
                nextUp.map((todo) => (
                  <div key={todo.id} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <PriorityDot priority={todo.priority} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-on-surface">{todo.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{todo.category}</span>
                          {todo.due_date && <span>{formatDate(todo.due_date)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
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
      className="group rounded-[22px] border border-black/5 bg-white px-4 py-3.5 shadow-[0_18px_44px_-36px_rgba(31,37,35,0.28)]"
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(todo.id, todo.completed)}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            todo.completed ? 'border-[#202625] bg-[#202625] text-white' : 'border-outline-variant hover:border-on-surface'
          )}
        >
          {todo.completed && <Check size={11} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-semibold leading-6', todo.completed ? 'text-on-surface-variant line-through' : 'text-on-surface')}>
            {todo.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span>{todo.category}</span>
            {todo.due_date && (
              <span className={cn(isOverdue(todo.due_date) && !todo.completed ? 'text-[#a55a2c]' : '')}>
                {formatDate(todo.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <PriorityDot priority={todo.priority} />
        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <AIContextButton type="todo" title={todo.title} id={todo.id} />
          <button
            onClick={() => onDelete(todo.id)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-[#a55a2c]"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
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
    <div className={cn('group rounded-[24px] px-4 py-3.5 transition-colors hover:bg-surface-container-low', todo.completed && 'opacity-60')}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(todo.id, todo.completed)}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            todo.completed ? 'border-[#202625] bg-[#202625] text-white' : 'border-outline-variant hover:border-on-surface'
          )}
        >
          {todo.completed && <Check size={11} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <p className={cn('text-sm font-semibold leading-6', todo.completed ? 'line-through text-on-surface-variant' : 'text-on-surface')}>
              {todo.title}
            </p>
            {todo.project_title && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: `${todo.project_color ?? '#5a677b'}18`,
                  color: todo.project_color ?? '#5a677b',
                }}
              >
                {todo.project_title}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <PriorityDot priority={todo.priority} />
            <span>{todo.category}</span>
            {todo.due_date && (
              <span className={cn('inline-flex items-center gap-1', isOverdue(todo.due_date) && !todo.completed ? 'text-[#a55a2c]' : '')}>
                <Calendar size={11} />
                {formatDate(todo.due_date)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <AIContextButton type="todo" title={todo.title} id={todo.id} />
          <button
            onClick={() => onDelete(todo.id)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-[#a55a2c]"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
