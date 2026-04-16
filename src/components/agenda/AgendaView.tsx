'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CalendarDays, Trash2, ChevronLeft, ChevronRight, CheckSquare, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday, isPast } from 'date-fns'
import { nl } from 'date-fns/locale'

const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

interface AgendaEvent {
  id: number
  title: string
  description?: string
  date: string
  time?: string
  duration: number
  type: string
  contact_name?: string
}

interface Todo {
  id: number
  title: string
  due_date?: string
  priority: string
  completed: number
}

const TYPE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  vergadering: { label: 'Vergadering', dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700' },
  deadline:    { label: 'Deadline',    dot: 'bg-red-400',  bg: 'bg-red-50',  text: 'text-red-700' },
  afspraak:    { label: 'Afspraak',   dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  herinnering: { label: 'Herinnering', dot: 'bg-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  algemeen:    { label: 'Algemeen',   dot: 'bg-gray-300', bg: 'bg-gray-50', text: 'text-gray-600' },
}

const EMPTY_FORM = { title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '', type: 'algemeen', description: '' }

export default function AgendaView() {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [eventsRes, todosRes] = await Promise.all([
      fetch(`/api/events?from=${from}&to=${to}`).then(r => r.json()),
      fetch('/api/todos?filter=week').then(r => r.json()),
    ])
    setEvents(eventsRes.data ?? [])
    setTodos(todosRes.data ?? [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchData() }, [fetchData])

  async function saveEvent() {
    if (!form.title.trim() || !form.date) return
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ ...EMPTY_FORM })
    setShowAdd(false)
    fetchData()
  }

  async function deleteEvent(id: number) {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  function eventsForDay(day: Date) {
    return events
      .filter(e => { try { return isSameDay(parseISO(e.date), day) } catch { return false } })
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
  }

  function todosForDay(day: Date) {
    return todos.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day))
  }

  const selectedEvents = eventsForDay(selectedDay)
  const selectedTodos = todosForDay(selectedDay)
  const totalWeekItems = events.length + todos.filter(t => t.due_date).length

  // Timeline hours to show
  const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 07:00 – 19:00

  function eventToTimelinePos(time?: string): { top: number; valid: boolean } {
    if (!time) return { top: -1, valid: false }
    const [h, m] = time.split(':').map(Number)
    if (isNaN(h)) return { top: -1, valid: false }
    const minutesFrom7 = (h - 7) * 60 + (m || 0)
    return { top: Math.max(0, (minutesFrom7 / (13 * 60)) * 100), valid: h >= 7 && h <= 20 }
  }

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 sm:px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gradient">Agenda</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Week van {format(weekStart, 'd MMMM', { locale: nl })} · {totalWeekItems} items
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart(v => addDays(v, -7))} className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-pink-200 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setSelectedDay(new Date()) }} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 hover:border-pink-200 transition-colors">
              Vandaag
            </button>
            <button onClick={() => setWeekStart(v => addDays(v, 7))} className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-pink-200 transition-colors">
              <ChevronRight size={15} />
            </button>
            <button onClick={() => setShowAdd(s => !s)} className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity" style={{ background: GRAD }}>
              <span className="flex items-center gap-1.5"><Plus size={14} />Nieuw</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col xl:flex-row">
        {/* Week grid */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {showAdd && (
            <div className="mb-5 rounded-2xl border border-pink-100 bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-700">Nieuw evenement</p>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titel *" className="sm:col-span-2 rounded-xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="rounded-xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="rounded-xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none">
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Omschrijving" className="rounded-xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none" />
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={saveEvent} className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90" style={{ background: GRAD }}>Opslaan</button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-600">Annuleer</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {/* Day headers */}
              {weekDays.map(day => {
                const today = isToday(day)
                const selected = isSameDay(day, selectedDay)
                const dayEvents = eventsForDay(day)
                const dayTodos = todosForDay(day)
                const total = dayEvents.length + dayTodos.length
                const past = isPast(day) && !today

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      'flex flex-col items-center rounded-2xl p-2 sm:p-3 transition-all border',
                      selected
                        ? 'border-pink-200 shadow-md'
                        : today
                          ? 'border-pink-100 bg-orange-50/50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50',
                      past && !selected ? 'opacity-50' : ''
                    )}
                    style={selected ? { background: 'linear-gradient(135deg,#fff5f0,#fdf2f8,#f5f3ff)' } : {}}
                  >
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wide mb-1', today ? 'text-pink-500' : 'text-gray-400')}>
                      {format(day, 'EE', { locale: nl }).slice(0, 2)}
                    </p>
                    <div
                      className={cn('flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold mb-2', today ? 'text-white shadow-sm' : selected ? 'text-gray-800' : 'text-gray-600')}
                      style={today ? { background: GRAD } : {}}
                    >
                      {format(day, 'd')}
                    </div>
                    {/* Event dots */}
                    <div className="flex flex-wrap justify-center gap-0.5 min-h-[12px]">
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <span key={i} className={cn('w-1.5 h-1.5 rounded-full', TYPE_CONFIG[e.type]?.dot ?? 'bg-gray-300')} />
                      ))}
                      {dayTodos.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                    </div>
                    {total > 0 && (
                      <p className={cn('text-[9px] font-semibold mt-1', selected ? 'text-pink-500' : 'text-gray-400')}>
                        {total} item{total !== 1 ? 's' : ''}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Selected day event cards — mobile/tablet */}
          <div className="mt-4 xl:hidden">
            <p className="text-sm font-bold text-gray-700 mb-3 capitalize">
              {format(selectedDay, 'EEEE d MMMM', { locale: nl })}
            </p>
            <DayDetail
              events={selectedEvents}
              todos={selectedTodos}
              onDelete={deleteEvent}
            />
          </div>
        </div>

        {/* Right sidebar: selected day detail + timeline */}
        <div className="hidden xl:flex xl:w-80 xl:flex-col border-l border-gray-100 bg-gray-50/40">
          <div className="border-b border-gray-100 px-5 py-4">
            <p className="text-sm font-bold text-gradient capitalize">
              {format(selectedDay, 'EEEE d MMMM', { locale: nl })}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedEvents.length} events · {selectedTodos.length} todos
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Timeline */}
            {selectedEvents.some(e => e.time) ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Tijdlijn</p>
                <div className="relative">
                  {HOURS.map(h => (
                    <div key={h} className="flex items-start gap-2 mb-0">
                      <span className="text-[10px] text-gray-300 w-8 flex-shrink-0 leading-none pt-0.5">{String(h).padStart(2, '0')}:00</span>
                      <div className="flex-1 border-t border-gray-100 pt-0.5 min-h-[28px] relative">
                        {selectedEvents
                          .filter(e => {
                            const [eh] = (e.time ?? '').split(':').map(Number)
                            return eh === h
                          })
                          .map(e => {
                            const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.algemeen
                            return (
                              <div key={e.id} className={cn('rounded-xl px-2.5 py-1.5 mb-1 flex items-start gap-2 group', cfg.bg)}>
                                <span className={cn('mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-xs font-semibold truncate', cfg.text)}>{e.title}</p>
                                  {e.time && <p className="text-[10px] text-gray-400">{e.time}{e.contact_name ? ` · ${e.contact_name}` : ''}</p>}
                                </div>
                                <button onClick={() => deleteEvent(e.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <DayDetail events={selectedEvents} todos={selectedTodos} onDelete={deleteEvent} />
            )}

            {selectedEvents.length === 0 && selectedTodos.length === 0 && (
              <div className="text-center py-8">
                <CalendarDays size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Niets gepland</p>
                <button
                  onClick={() => { setForm(f => ({ ...f, date: format(selectedDay, 'yyyy-MM-dd') })); setShowAdd(true) }}
                  className="mt-3 text-xs font-semibold text-pink-400 hover:text-pink-600 transition-colors"
                >
                  + Evenement toevoegen
                </button>
              </div>
            )}
          </div>

          {/* Week todos */}
          {todos.filter(t => t.due_date).length > 0 && (
            <div className="border-t border-gray-100 px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                <Clock size={10} />Todos met deadline deze week
              </p>
              <div className="space-y-1.5">
                {todos.filter(t => t.due_date).slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-2.5 py-1.5">
                    <CheckSquare size={11} className="text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-800 font-medium truncate flex-1">{t.title}</p>
                    <span className="text-[10px] text-amber-500">{format(parseISO(t.due_date!), 'E d', { locale: nl })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DayDetail({ events, todos, onDelete }: { events: AgendaEvent[]; todos: Todo[]; onDelete: (id: number) => void }) {
  if (events.length === 0 && todos.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">Niets gepland voor deze dag.</p>
  }

  return (
    <div className="space-y-2">
      {events.map(e => {
        const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.algemeen
        return (
          <div key={e.id} className={cn('rounded-2xl border px-3.5 py-3 flex items-start gap-3 group', cfg.bg, 'border-transparent')}>
            <span className={cn('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-semibold', cfg.text)}>{e.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {e.time ? e.time : 'Hele dag'}{e.description ? ` · ${e.description}` : ''}{e.contact_name ? ` · ${e.contact_name}` : ''}
              </p>
            </div>
            <button onClick={() => onDelete(e.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all mt-0.5">
              <Trash2 size={13} />
            </button>
          </div>
        )
      })}
      {todos.map(t => (
        <div key={t.id} className="rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-3 flex items-center gap-3">
          <CheckSquare size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800 flex-1 truncate">{t.title}</p>
          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', t.priority === 'hoog' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500')}>
            {t.priority}
          </span>
        </div>
      ))}
    </div>
  )
}
