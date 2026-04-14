'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, Trash2, Calendar } from 'lucide-react'
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
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Todos</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{openCount} open taken</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
        >
          <Plus size={14} />
          Toevoegen
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mx-6 mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-fade-in shadow-sm">
          <input
            autoFocus
            value={newTodo.title}
            onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addTodo()}
            placeholder="Wat moet je doen?"
            className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none border-b border-gray-200 pb-2 mb-3"
          />
          <div className="flex gap-2 flex-wrap">
            <select
              value={newTodo.priority}
              onChange={e => setNewTodo(p => ({ ...p, priority: e.target.value }))}
              className="bg-white text-xs text-gray-600 rounded-lg px-2 py-1.5 outline-none border border-gray-200"
            >
              <option value="hoog">Hoog</option>
              <option value="medium">Medium</option>
              <option value="laag">Laag</option>
            </select>
            <select
              value={newTodo.category}
              onChange={e => setNewTodo(p => ({ ...p, category: e.target.value }))}
              className="bg-white text-xs text-gray-600 rounded-lg px-2 py-1.5 outline-none border border-gray-200"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="date"
              value={newTodo.due_date}
              onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value }))}
              className="bg-white text-xs text-gray-600 rounded-lg px-2 py-1.5 outline-none border border-gray-200"
            />
            <div className="flex-1" />
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 transition-colors">Annuleer</button>
            <button
              onClick={addTodo}
              className="text-xs text-white px-4 py-1.5 rounded-lg font-semibold shadow-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
            >
              Toevoegen
            </button>
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
              'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
              filter === f
                ? 'text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
            style={filter === f ? { background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' } : {}}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : todos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">Geen todos{filter !== 'Alles' ? ` voor "${filter}"` : ''}.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {todos.map(todo => (
              <div
                key={todo.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 group transition-all duration-150',
                  todo.completed && 'opacity-40'
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-150',
                    todo.completed
                      ? 'border-transparent'
                      : 'border-gray-300 hover:border-pink-400'
                  )}
                  style={todo.completed ? { background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' } : {}}
                >
                  {todo.completed && <Check size={11} className="text-white" strokeWidth={3} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', todo.completed ? 'line-through text-gray-400' : 'text-gray-700')}>
                    {todo.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border font-medium', PRIORITY_COLORS[todo.priority])}>
                      {todo.priority}
                    </span>
                    {todo.category !== 'overig' && (
                      <span className="text-[10px] text-gray-400">{todo.category}</span>
                    )}
                    {todo.due_date && (
                      <span className={cn('text-[10px] flex items-center gap-1 font-medium', isOverdue(todo.due_date) && !todo.completed ? 'text-red-400' : 'text-gray-400')}>
                        <Calendar size={9} />
                        {formatDate(todo.due_date)}
                        {isOverdue(todo.due_date) && !todo.completed && ' ⚠'}
                      </span>
                    )}
                    {todo.project_title && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: todo.project_color + '18', color: todo.project_color }}>
                        {todo.project_title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all p-1"
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
