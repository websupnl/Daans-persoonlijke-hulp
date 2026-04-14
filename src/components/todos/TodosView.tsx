'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Trash2, ChevronDown, Filter, Calendar } from 'lucide-react'
import { cn, formatDate, isOverdue, PRIORITY_COLORS, PRIORITY_DOT } from '@/lib/utils'

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

const FILTERS = ['Alles', 'Vandaag', 'Deze week', 'Te laat', 'Afgerond']
const CATEGORIES = ['overig', 'werk', 'financieel', 'gezondheid', 'persoonlijk', 'studie']

export default function TodosView() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState('Alles')
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newTodo, setNewTodo] = useState({ title: '', priority: 'medium', category: 'overig', due_date: '' })

  const fetchTodos = useCallback(async () => {
    const params = new URLSearchParams()
    if (filter === 'Vandaag') params.set('filter', 'today')
    else if (filter === 'Deze week') params.set('filter', 'week')
    else if (filter === 'Te laat') params.set('filter', 'overdue')
    else if (filter === 'Afgerond') params.set('completed', '1')

    const res = await fetch(`/api/todos?${params}`)
    const data = await res.json()
    setTodos(data.data || [])
    setLoading(false)
  }, [filter])

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

  const openCount = todos.filter(t => !t.completed).length

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Todos</h1>
          <p className="text-xs text-slate-500 mt-0.5">{openCount} open taken</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-500 transition-colors"
        >
          <Plus size={14} />
          Toevoegen
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mx-6 mt-4 p-4 bg-[#13151c] border border-white/10 rounded-xl animate-fade-in">
          <input
            autoFocus
            value={newTodo.title}
            onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="Wat moet je doen?"
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 outline-none border-b border-white/10 pb-2 mb-3"
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={newTodo.priority}
              onChange={e => setNewTodo(p => ({ ...p, priority: e.target.value }))}
              className="bg-white/5 text-xs text-slate-300 rounded-lg px-2 py-1.5 outline-none border border-white/10"
            >
              <option value="hoog">Hoog</option>
              <option value="medium">Medium</option>
              <option value="laag">Laag</option>
            </select>
            <select
              value={newTodo.category}
              onChange={e => setNewTodo(p => ({ ...p, category: e.target.value }))}
              className="bg-white/5 text-xs text-slate-300 rounded-lg px-2 py-1.5 outline-none border border-white/10"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              value={newTodo.due_date}
              onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value }))}
              className="bg-white/5 text-xs text-slate-300 rounded-lg px-2 py-1.5 outline-none border border-white/10"
            />
            <div className="flex-1" />
            <button onClick={() => setShowAdd(false)} className="text-xs text-slate-500 hover:text-slate-300 px-2">Annuleer</button>
            <button onClick={addTodo} className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-500 transition-colors">Toevoegen</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 pt-4 pb-2 flex gap-1.5 flex-shrink-0">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-colors',
              filter === f ? 'bg-brand-600/20 text-brand-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : todos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600 text-sm">Geen todos{filter !== 'Alles' ? ` voor "${filter}"` : ''}.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {todos.map(todo => (
              <div
                key={todo.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 group transition-all duration-150',
                  todo.completed && 'opacity-50'
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-150',
                    todo.completed
                      ? 'bg-brand-600 border-brand-600'
                      : 'border-slate-600 hover:border-brand-500'
                  )}
                >
                  {todo.completed && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', todo.completed ? 'line-through text-slate-500' : 'text-slate-200')}>
                    {todo.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', PRIORITY_COLORS[todo.priority])}>
                      {todo.priority}
                    </span>
                    {todo.category !== 'overig' && (
                      <span className="text-[10px] text-slate-600">{todo.category}</span>
                    )}
                    {todo.due_date && (
                      <span className={cn('text-[10px] flex items-center gap-1', isOverdue(todo.due_date) && !todo.completed ? 'text-red-400' : 'text-slate-600')}>
                        <Calendar size={9} />
                        {formatDate(todo.due_date)}
                        {isOverdue(todo.due_date) && !todo.completed && ' ⚠'}
                      </span>
                    )}
                    {todo.project_title && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: todo.project_color + '22', color: todo.project_color }}>
                        {todo.project_title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
