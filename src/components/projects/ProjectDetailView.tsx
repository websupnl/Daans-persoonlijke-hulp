'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckSquare, FileText, Clock, TrendingUp, Zap, Euro,
  Play, Square, Plus, Sparkles, ChevronDown, ChevronUp, Circle,
  CheckCircle2, AlertCircle, Timer, BarChart2, RefreshCw,
} from 'lucide-react'
import { cn, PROJECT_COLORS } from '@/lib/utils'

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

interface Project {
  id: number; title: string; description?: string; status: 'actief' | 'on-hold' | 'afgerond'
  color: string; open_todos: number; total_todos: number; note_count: number
  total_minutes: number; created_at: string
}
interface Todo { id: number; title: string; priority: string; completed: number; due_date?: string; category?: string }
interface Note { id: number; title: string; content_text?: string; pinned: number; created_at: string }
interface Worklog { id: number; title: string; duration_minutes: number; date: string; context: string }
interface FinanceItem { id: number; type: string; title: string; amount: number; status: string; due_date?: string }
interface ActiveTimer { id: number; title: string; project_id: number | null; project_title: string | null; elapsed_minutes: number; started_at: string }

const STATUS_LABELS = { actief: 'Actief', 'on-hold': 'On Hold', afgerond: 'Afgerond' }
const PRIORITY_COLOR: Record<string, string> = { hoog: 'text-red-500 bg-red-50', medium: 'text-amber-500 bg-amber-50', laag: 'text-gray-400 bg-gray-50' }
const CONTEXT_COLOR: Record<string, string> = { WebsUp: 'bg-violet-100 text-violet-700', Bouma: 'bg-blue-100 text-blue-700', 'privé': 'bg-green-100 text-green-700', studie: 'bg-amber-100 text-amber-700', overig: 'bg-gray-100 text-gray-500' }

function fmtMinutes(min: number) {
  const h = Math.floor(min / 60); const m = min % 60
  return h > 0 ? `${h}u ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}

export default function ProjectDetailView({ projectId }: { projectId: number }) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [worklogs, setWorklogs] = useState<Worklog[]>([])
  const [finance, setFinance] = useState<FinanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [timer, setTimer] = useState<ActiveTimer | null>(null)
  const [timerElapsed, setTimerElapsed] = useState(0)
  const [brief, setBrief] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'todos' | 'worklogs' | 'notes' | 'finance'>('todos')
  const [newTodo, setNewTodo] = useState('')
  const [addingTodo, setAddingTodo] = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async () => {
    const [projRes, timerRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch('/api/timers').then(r => r.json()),
    ])
    setProject(projRes.data || null)
    setTodos(projRes.todos || [])
    setNotes(projRes.notes || [])
    setWorklogs(projRes.worklogs || [])
    setFinance(projRes.finance || [])
    setTitleValue(projRes.data?.title || '')
    const t = timerRes.timer
    if (t && t.project_id === projectId) { setTimer(t); setTimerElapsed(t.elapsed_minutes) }
    else { setTimer(null); setTimerElapsed(0) }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Tick timer
  useEffect(() => {
    if (timer) {
      intervalRef.current = setInterval(() => setTimerElapsed(e => e + 1), 60000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timer])

  async function startTimer() {
    if (!project) return
    await fetch('/api/timers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', title: project.title, context: 'WebsUp', project_id: project.id }) })
    fetchAll()
  }

  async function stopTimer() {
    await fetch('/api/timers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
    fetchAll()
  }

  async function loadBrief() {
    if (brief) { setBriefOpen(o => !o); return }
    setBriefLoading(true); setBriefOpen(true)
    const res = await fetch(`/api/projects/${projectId}/brief`).then(r => r.json())
    setBrief(res.brief || 'Geen brief beschikbaar.')
    setBriefLoading(false)
  }

  async function completeTodo(id: number) {
    await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: 1 }) })
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: 1 } : t))
  }

  async function addTodo() {
    if (!newTodo.trim()) return
    setAddingTodo(true)
    await fetch('/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTodo, project_id: projectId, priority: 'medium' }) })
    setNewTodo(''); setAddingTodo(false); fetchAll()
  }

  async function updateStatus(status: string) {
    await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setProject(p => p ? { ...p, status: status as Project['status'] } : p)
  }

  async function saveTitle() {
    if (!titleValue.trim()) return
    await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: titleValue }) })
    setProject(p => p ? { ...p, title: titleValue } : p)
    setEditTitle(false)
  }

  if (loading) return (
    <div className="flex min-h-full items-center justify-center bg-white">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
    </div>
  )

  if (!project) return (
    <div className="flex min-h-full items-center justify-center bg-white">
      <p className="text-gray-400 text-sm">Project niet gevonden.</p>
    </div>
  )

  const progressPct = project.total_todos > 0 ? Math.round(((project.total_todos - project.open_todos) / project.total_todos) * 100) : 0
  const totalHours = Math.round((project.total_minutes || 0) / 60 * 10) / 10
  const openTodos = todos.filter(t => !t.completed)
  const doneTodos = todos.filter(t => t.completed)
  const overdueTodos = openTodos.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0])
  const financeTotal = finance.filter(f => f.type === 'factuur' && f.status === 'betaald').reduce((s, f) => s + Number(f.amount), 0)
  const openInvoices = finance.filter(f => f.type === 'factuur' && f.status !== 'betaald' && f.status !== 'geannuleerd')

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/projects')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </button>
        <div className="w-2.5 h-8 rounded-full flex-shrink-0" style={{ background: project.color }} />
        <div className="flex-1 min-w-0">
          {editTitle ? (
            <div className="flex gap-2 items-center">
              <input autoFocus value={titleValue} onChange={e => setTitleValue(e.target.value)} onBlur={saveTitle} onKeyDown={e => e.key === 'Enter' && saveTitle()} className="text-lg font-bold text-gray-800 border-b-2 border-pink-400 outline-none bg-transparent w-full" />
            </div>
          ) : (
            <h1 onClick={() => setEditTitle(true)} className="text-lg font-extrabold text-gray-800 truncate cursor-pointer hover:text-pink-500 transition-colors">{project.title}</h1>
          )}
          {project.description && <p className="text-xs text-gray-400 truncate">{project.description}</p>}
        </div>
        <select value={project.status} onChange={e => updateStatus(e.target.value)} className={cn('text-[10px] px-2.5 py-1.5 rounded-xl border-0 outline-none cursor-pointer font-semibold', { actief: 'text-emerald-600 bg-emerald-50', 'on-hold': 'text-amber-600 bg-amber-50', afgerond: 'text-gray-400 bg-gray-100' }[project.status])}>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-10">

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard icon={<CheckSquare size={14} />} label="Open taken" value={String(openTodos.length)} warn={overdueTodos.length > 0} warnText={`${overdueTodos.length} verlopen`} />
          <StatCard icon={<Clock size={14} />} label="Gewerkt" value={`${totalHours}u`} />
          <StatCard icon={<TrendingUp size={14} />} label="Voortgang" value={`${progressPct}%`} />
          {financeTotal > 0 ? <StatCard icon={<Euro size={14} />} label="Betaald" value={`€${financeTotal.toFixed(0)}`} /> : <StatCard icon={<FileText size={14} />} label="Notes" value={String(notes.length)} />}
        </div>

        {/* Progress bar */}
        {project.total_todos > 0 && (
          <div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: GRAD }} />
            </div>
            <p className="text-[10px] text-gradient font-bold mt-1">{progressPct}% van de taken klaar</p>
          </div>
        )}

        {/* Active timer */}
        <div className={cn('rounded-2xl p-4 flex items-center justify-between', timer ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100')}>
          {timer ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-green-700">Timer loopt</p>
                  <p className="text-[11px] text-green-600">{fmtMinutes(timerElapsed)} bezig</p>
                </div>
              </div>
              <button onClick={stopTimer} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-green-200 rounded-xl text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors shadow-sm">
                <Square size={12} /> Stop & log
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-gray-400">
                <Timer size={14} />
                <span className="text-xs font-medium">Geen actieve timer</span>
              </div>
              <button onClick={startTimer} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-semibold shadow-sm" style={{ background: GRAD }}>
                <Play size={11} /> Start timer
              </button>
            </>
          )}
        </div>

        {/* AI Brief */}
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <button onClick={loadBrief} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-pink-500" />
              <span className="text-sm font-bold text-gray-700">AI Project Brief</span>
            </div>
            {briefLoading ? <RefreshCw size={14} className="text-gray-400 animate-spin" /> : briefOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </button>
          {briefOpen && (
            <div className="px-4 pb-4 border-t border-gray-50">
              {briefLoading ? (
                <div className="py-3 flex items-center gap-2 text-gray-400 text-xs"><RefreshCw size={12} className="animate-spin" /> Brief genereren...</div>
              ) : (
                <p className="text-sm text-gray-600 leading-relaxed pt-3">{brief}</p>
              )}
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
          {([['todos', 'Taken', openTodos.length], ['worklogs', 'Uren', worklogs.length], ['notes', 'Notes', notes.length], ['finance', 'Financiën', finance.length]] as [string, string, number][]).map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveSection(key as typeof activeSection)} className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors', activeSection === key ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
              {label}
              {count > 0 && <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold', activeSection === key ? 'bg-gray-100 text-gray-500' : 'bg-gray-200 text-gray-400')}>{count}</span>}
            </button>
          ))}
        </div>

        {/* TODOS */}
        {activeSection === 'todos' && (
          <div className="space-y-2">
            {overdueTodos.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-500 font-semibold mb-1">
                <AlertCircle size={12} /> {overdueTodos.length} verlopen {overdueTodos.length === 1 ? 'taak' : 'taken'}
              </div>
            )}
            {/* Add todo inline */}
            <div className="flex gap-2">
              <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTodo()} placeholder="Nieuwe taak toevoegen..." className="flex-1 text-sm text-gray-700 placeholder:text-gray-300 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 outline-none focus:border-pink-300 transition-colors" />
              <button onClick={addTodo} disabled={addingTodo || !newTodo.trim()} className="px-3 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-50 transition-opacity" style={{ background: GRAD }}>
                <Plus size={14} />
              </button>
            </div>
            {openTodos.length === 0 && doneTodos.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nog geen taken.</p>}
            {openTodos.map(t => (
              <TodoRow key={t.id} todo={t} onComplete={() => completeTodo(t.id)} />
            ))}
            {doneTodos.length > 0 && (
              <details className="group">
                <summary className="text-xs text-gray-400 font-medium cursor-pointer hover:text-gray-600 py-1 list-none flex items-center gap-1">
                  <ChevronDown size={12} className="group-open:rotate-180 transition-transform" /> {doneTodos.length} afgeronde taken
                </summary>
                <div className="space-y-1 mt-1">
                  {doneTodos.map(t => <TodoRow key={t.id} todo={t} done />)}
                </div>
              </details>
            )}
          </div>
        )}

        {/* WORKLOGS */}
        {activeSection === 'worklogs' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">Totaal: <span className="text-gray-700 font-bold">{fmtMinutes(project.total_minutes || 0)}</span></p>
              {!timer && (
                <button onClick={startTimer} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: GRAD }}>
                  <Play size={11} /> Start timer
                </button>
              )}
            </div>
            {worklogs.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nog geen werklogs.</p>}
            {worklogs.map(w => (
              <div key={w.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{w.title}</p>
                  <p className="text-[10px] text-gray-400">{w.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', CONTEXT_COLOR[w.context] || CONTEXT_COLOR.overig)}>{w.context}</span>
                  <span className="text-xs font-bold text-gray-600">{fmtMinutes(w.duration_minutes)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NOTES */}
        {activeSection === 'notes' && (
          <div className="space-y-2">
            {notes.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nog geen notes.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {notes.map(n => (
                <div key={n.id} className={cn('bg-gray-50 border rounded-xl p-3 cursor-pointer hover:border-gray-200 transition-colors', n.pinned ? 'border-pink-100' : 'border-gray-100')}>
                  {n.pinned ? <span className="text-[9px] text-pink-400 font-bold uppercase tracking-wide">Gepind</span> : null}
                  <p className="text-sm font-bold text-gray-700 truncate">{n.title}</p>
                  {n.content_text && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.content_text}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINANCE */}
        {activeSection === 'finance' && (
          <div className="space-y-2">
            {openInvoices.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                <p className="text-xs font-bold text-amber-700 mb-1">Openstaande facturen</p>
                {openInvoices.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-0.5">
                    <span className="text-xs text-amber-700 truncate max-w-[180px]">{f.title}</span>
                    <span className="text-xs font-bold text-amber-700">€{Number(f.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            {finance.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Geen financiële items gekoppeld.</p>}
            {finance.map(f => (
              <div key={f.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700 truncate max-w-[180px]">{f.title}</p>
                  <span className={cn('text-[9px] font-bold uppercase tracking-wide', f.type === 'factuur' ? 'text-blue-500' : f.type === 'inkomst' ? 'text-green-500' : 'text-red-400')}>{f.type}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-700">€{Number(f.amount).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">{f.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, warn, warnText }: { icon: React.ReactNode; label: string; value: string; warn?: boolean; warnText?: string }) {
  return (
    <div className={cn('rounded-xl p-3 border flex flex-col gap-1', warn ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100')}>
      <div className={cn('flex items-center gap-1', warn ? 'text-red-400' : 'text-gray-400')}>{icon}<span className="text-[9px] font-medium truncate">{label}</span></div>
      <p className={cn('text-base font-extrabold', warn ? 'text-red-600' : 'text-gray-700')}>{value}</p>
      {warn && warnText && <p className="text-[9px] text-red-400 font-medium">{warnText}</p>}
    </div>
  )
}

function TodoRow({ todo, onComplete, done }: { todo: Todo; onComplete?: () => void; done?: boolean }) {
  const overdue = !done && todo.due_date && todo.due_date < new Date().toISOString().split('T')[0]
  return (
    <div className={cn('flex items-center gap-2 p-2.5 rounded-xl border transition-colors', done ? 'border-gray-50 bg-gray-50/50 opacity-50' : overdue ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white hover:border-gray-200')}>
      <button onClick={onComplete} disabled={done} className="flex-shrink-0 text-gray-300 hover:text-green-400 transition-colors disabled:pointer-events-none">
        {done ? <CheckCircle2 size={16} className="text-gray-300" /> : <Circle size={16} />}
      </button>
      <span className={cn('text-sm flex-1 truncate', done ? 'line-through text-gray-400' : overdue ? 'text-red-600' : 'text-gray-700')}>{todo.title}</span>
      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', PRIORITY_COLOR[todo.priority])}>{todo.priority}</span>
      {todo.due_date && !done && <span className={cn('text-[9px] flex-shrink-0', overdue ? 'text-red-500 font-bold' : 'text-gray-400')}>{todo.due_date}</span>}
    </div>
  )
}
