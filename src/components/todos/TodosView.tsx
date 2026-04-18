'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Trash2, Calendar, LayoutGrid, ListTodo, Sparkles, Loader2 } from 'lucide-react'
import { cn, formatDate, isOverdue } from '@/lib/utils'
import PageShell, { PageSection } from '@/components/ui/PageShell'
import { Card, CardLow, Tag, PriorityDot } from '@/components/ui/Card'
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
  { key: 'hoog',    label: 'Nu eerst',  color: 'bg-red-100 text-red-600' },
  { key: 'today',   label: 'Vandaag',   color: 'bg-orange-100 text-orange-600' },
  { key: 'planned', label: 'Gepland',   color: 'bg-blue-100 text-blue-600' },
  { key: 'later',   label: 'Later',     color: 'bg-surface-container text-on-surface-variant' },
] as const

type Filter = typeof FILTERS[number]
type Category = typeof CATEGORIES[number]
type ViewMode = 'list' | 'board'

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

  async function moveTodo(id: number, column: typeof PIPELINE[number]['key']) {
    const payload: Record<string, string | null> = {}
    if (column === 'hoog') { payload.priority = 'hoog' }
    else if (column === 'today') { payload.priority = 'medium'; payload.due_date = new Date().toISOString().split('T')[0] }
    else if (column === 'planned') { const t = new Date(); t.setDate(t.getDate() + 1); payload.priority = 'medium'; payload.due_date = t.toISOString().split('T')[0] }
    else if (column === 'later') { payload.priority = 'laag'; payload.due_date = null }
    await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    fetchTodos()
  }

  async function getRecommendation() {
    setLoadingRec(true); setRecommendation(null)
    try {
      const res = await fetch('/api/todos/recommend')
      const data = await res.json()
      setRecommendation(data.recommendation)
    } finally { setLoadingRec(false) }
  }

  const openCount   = todos.filter(t => !t.completed).length
  const overdueCount= todos.filter(t => !t.completed && isOverdue(t.due_date)).length
  const todayCount  = todos.filter(t => !t.completed && formatDate(t.due_date) === 'Vandaag').length

  const boardCols = {
    hoog:    todos.filter(t => !t.completed && t.priority === 'hoog'),
    today:   todos.filter(t => !t.completed && formatDate(t.due_date) === 'Vandaag' && t.priority !== 'hoog'),
    planned: todos.filter(t => !t.completed && !!t.due_date && formatDate(t.due_date) !== 'Vandaag' && !isOverdue(t.due_date) && t.priority !== 'hoog'),
    later:   todos.filter(t => !t.completed && !t.due_date && t.priority !== 'hoog'),
  }

  return (
    <PageShell
      title="Todo's"
      subtitle={`${openCount} open · ${todayCount} vandaag${overdueCount > 0 ? ` · ${overdueCount} te laat` : ''}`}
      actions={
        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex bg-surface-container rounded-xl p-0.5">
            {(['list', 'board'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all', viewMode === m ? 'btn-gradient shadow-ambient-xs' : 'text-on-surface-variant')}
              >
                {m === 'list' ? <ListTodo size={13} /> : <LayoutGrid size={13} />}
              </button>
            ))}
          </div>
          <button
            onClick={getRecommendation}
            disabled={loadingRec}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {loadingRec ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Wat nu?
          </button>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl btn-gradient text-xs font-semibold text-white"
          >
            <Plus size={12} /> Todo
          </button>
        </div>
      }
    >
      {/* AI recommendation */}
      {recommendation && (
        <Card className="p-4 bg-brand-subtle relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-pink-100/50 rounded-full -translate-y-8 translate-x-8 blur-xl" />
          <div className="relative flex items-start gap-3">
            <Sparkles size={15} className="icon-gradient mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">AI Aanbeveling</p>
              <p className="text-sm text-on-surface leading-relaxed">{recommendation}</p>
            </div>
            <button onClick={() => setRecommendation(null)} className="text-on-surface-variant hover:text-on-surface shrink-0">
              <Plus size={14} className="rotate-45" />
            </button>
          </div>
        </Card>
      )}

      {/* Add form */}
      {showAdd && (
        <Card className="p-4">
          <input
            autoFocus
            value={newTodo.title}
            onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="Wat moet er gebeuren?"
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant outline-none border-b border-outline-variant pb-2 mb-3"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <select value={newTodo.priority} onChange={e => setNewTodo(p => ({ ...p, priority: e.target.value }))}
              className="rounded-xl bg-surface-container px-2.5 py-1.5 text-xs text-on-surface-variant outline-none">
              <option value="hoog">Hoog</option>
              <option value="medium">Medium</option>
              <option value="laag">Laag</option>
            </select>
            <select value={newTodo.category} onChange={e => setNewTodo(p => ({ ...p, category: e.target.value }))}
              className="rounded-xl bg-surface-container px-2.5 py-1.5 text-xs text-on-surface-variant outline-none">
              {CATEGORIES.filter(c => c !== 'alles').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={newTodo.due_date} onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value }))}
              className="rounded-xl bg-surface-container px-2.5 py-1.5 text-xs text-on-surface-variant outline-none" />
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface">Annuleer</button>
              <button onClick={addTodo} className="px-3 py-1.5 text-xs font-semibold text-white rounded-xl btn-gradient">Opslaan</button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition-all', filter === f ? 'btn-gradient text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high')}>
              {f}{f === 'Te laat' && overdueCount > 0 && <span className="ml-1 bg-red-500 text-white px-1 rounded-full text-[9px]">{overdueCount}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all', category === c ? 'btn-gradient text-white' : 'text-on-surface-variant hover:bg-surface-container')}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-pink-400" />
        </div>
      ) : todos.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant text-sm">Geen todos gevonden.</div>
      ) : viewMode === 'board' && filter !== 'Afgerond' ? (
        /* Board view */
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {PIPELINE.map(col => (
            <div
              key={col.key}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/plain')); if (id) moveTodo(id, col.key) }}
              className="bg-surface-container-low rounded-2xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className={cn('text-xs font-bold px-2 py-0.5 rounded-full', col.color)}>{col.label}</p>
                <span className="text-[10px] text-on-surface-variant font-bold">{boardCols[col.key].length}</span>
              </div>
              <div className="space-y-2 min-h-[40px]">
                {boardCols[col.key].length === 0 ? (
                  <div className="border-2 border-dashed border-outline-variant/20 rounded-xl py-4 text-center text-[10px] text-on-surface-variant">leeg</div>
                ) : boardCols[col.key].map(todo => (
                  <TodoCard key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <Card className="p-1 divide-y divide-surface-container/50">
          {todos.map(todo => (
            <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
          ))}
        </Card>
      )}
    </PageShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function TodoCard({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (id: number, completed: boolean) => void; onDelete: (id: number) => void }) {
  return (
    <div
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', String(todo.id))}
      className="group bg-surface-container-lowest rounded-xl p-2.5 shadow-ambient-xs hover:shadow-ambient-sm transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start gap-2 mb-1.5">
        <button
          onClick={() => onToggle(todo.id, todo.completed)}
          className={cn('mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all', todo.completed ? 'border-transparent bg-brand-gradient' : 'border-outline-variant hover:border-pink-400')}
          style={todo.completed ? { background: 'var(--gradient)' } : undefined}
        >
          {todo.completed && <Check size={9} className="text-white" strokeWidth={3} />}
        </button>
        <p className={cn('text-xs font-medium flex-1 leading-snug', todo.completed ? 'line-through text-on-surface-variant' : 'text-on-surface')}>{todo.title}</p>
      </div>
      <div className="flex items-center gap-1.5 pl-6">
        <PriorityDot priority={todo.priority} />
        {todo.due_date && (
          <span className={cn('text-[9px]', isOverdue(todo.due_date) && !todo.completed ? 'text-red-500' : 'text-on-surface-variant')}>
            {formatDate(todo.due_date)}
          </span>
        )}
        <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
          <AIContextButton type="todo" title={todo.title} id={todo.id} />
          <button onClick={() => onDelete(todo.id)} className="text-on-surface-variant hover:text-red-500"><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  )
}

function TodoRow({ todo, onToggle, onDelete }: { todo: Todo; onToggle: (id: number, completed: boolean) => void; onDelete: (id: number) => void }) {
  return (
    <div className={cn('group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors', todo.completed && 'opacity-50')}>
      <button
        onClick={() => onToggle(todo.id, todo.completed)}
        className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all', todo.completed ? 'border-transparent' : 'border-outline-variant hover:border-pink-400')}
        style={todo.completed ? { background: 'var(--gradient)' } : undefined}
      >
        {todo.completed && <Check size={10} className="text-white" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', todo.completed ? 'line-through text-on-surface-variant' : 'text-on-surface')}>{todo.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <PriorityDot priority={todo.priority} />
          <span className="text-[10px] text-on-surface-variant">{todo.category}</span>
          {todo.due_date && (
            <span className={cn('text-[10px]', isOverdue(todo.due_date) && !todo.completed ? 'text-red-500 font-medium' : 'text-on-surface-variant')}>
              <Calendar size={8} className="inline mr-0.5" />{formatDate(todo.due_date)}
            </span>
          )}
          {todo.project_title && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${todo.project_color ?? '#ec4899'}18`, color: todo.project_color ?? '#ec4899' }}>
              {todo.project_title}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <AIContextButton type="todo" title={todo.title} id={todo.id} />
        <button onClick={() => onDelete(todo.id)} className="p-1 text-on-surface-variant hover:text-red-500 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
