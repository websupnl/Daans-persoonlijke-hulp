'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, CalendarDays, Clock, Trash2, ChevronLeft, ChevronRight, Sparkles, CheckSquare } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
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
  project_title?: string
  project_color?: string
  contact_name?: string
}

interface Todo {
  id: number
  title: string
  due_date?: string
  priority: string
}

const TYPE_COLORS: Record<string, string> = {
  vergadering: 'bg-blue-50 text-blue-700 border-blue-100',
  deadline: 'bg-red-50 text-red-700 border-red-100',
  afspraak: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  herinnering: 'bg-amber-50 text-amber-700 border-amber-100',
  algemeen: 'bg-gray-50 text-gray-600 border-gray-100',
}

const EMPTY_FORM = {
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  type: 'algemeen',
  description: '',
}

export default function AgendaView() {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const [eventsRes, todosRes] = await Promise.all([
      fetch(`/api/events?from=${from}&to=${to}`).then((r) => r.json()),
      fetch('/api/todos?filter=week').then((r) => r.json()),
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
    setEvents((prev) => prev.filter((event) => event.id !== id))
  }

  function eventsForDay(day: Date) {
    return events.filter((event) => {
      try {
        return isSameDay(parseISO(event.date), day)
      } catch {
        return false
      }
    })
  }

  function todosForDay(day: Date) {
    return todos.filter((todo) => todo.due_date && isSameDay(parseISO(todo.due_date), day))
  }

  const selectedDay = useMemo(() => {
    const todayInWeek = weekDays.find((day) => isSameDay(day, new Date()))
    return todayInWeek || weekDays[0]
  }, [weekDays])

  const selectedEvents = eventsForDay(selectedDay)
  const selectedTodos = todosForDay(selectedDay)
  const totalWeekItems = events.length + todos.filter((todo) => todo.due_date).length

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col bg-white">
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gradient">Agenda</h1>
            <p className="mt-1 text-sm font-medium text-gray-400">
              Week van {format(weekStart, 'd MMMM', { locale: nl })} · {totalWeekItems} geplande items
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((value) => addDays(value, -7))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-pink-200 hover:text-gray-800"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-pink-200 hover:text-gray-800"
            >
              Deze week
            </button>
            <button
              onClick={() => setWeekStart((value) => addDays(value, 7))}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-colors hover:border-pink-200 hover:text-gray-800"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setShowAdd((s) => !s)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: GRAD }}
            >
              <span className="flex items-center gap-1.5">
                <Plus size={14} />
                Nieuw
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-6">
          {showAdd && (
            <div className="mb-5 rounded-3xl border border-pink-100 bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                  placeholder="Titel *"
                  className="sm:col-span-2 rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
                />
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
                  className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
                />
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((current) => ({ ...current, time: e.target.value }))}
                  className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
                />
                <select
                  value={form.type}
                  onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
                  className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
                >
                  <option value="algemeen">Algemeen</option>
                  <option value="vergadering">Vergadering</option>
                  <option value="deadline">Deadline</option>
                  <option value="afspraak">Afspraak</option>
                  <option value="herinnering">Herinnering</option>
                </select>
                <input
                  value={form.description}
                  onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                  placeholder="Omschrijving"
                  className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={saveEvent} className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ background: GRAD }}>Opslaan</button>
                <button onClick={() => setShowAdd(false)} className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-gray-500">Annuleren</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {weekDays.map((day) => {
                const dayEvents = eventsForDay(day)
                const dayTodos = todosForDay(day)
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={day.toISOString()}
                    className={cn('rounded-3xl border p-4 shadow-sm transition-all', isToday ? 'border-pink-200 bg-gradient-to-br from-orange-50/70 via-pink-50/70 to-violet-50/70' : 'border-gray-100 bg-white')}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-bold', isToday ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500')} style={isToday ? { background: GRAD } : undefined}>
                        {format(day, 'd')}
                      </div>
                      <div>
                        <p className={cn('text-sm font-bold capitalize', isToday ? 'text-gradient' : 'text-gray-700')}>
                          {format(day, 'EEEE', { locale: nl })}
                        </p>
                        <p className="text-xs text-gray-400">{dayEvents.length} events · {dayTodos.length} todos</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div key={`event-${event.id}`} className={cn('rounded-2xl border px-3 py-2.5 text-sm', TYPE_COLORS[event.type] || TYPE_COLORS.algemeen)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{event.title}</p>
                              <p className="mt-0.5 text-xs opacity-70">
                                {event.time || 'Hele dag'}{event.contact_name ? ` · ${event.contact_name}` : ''}
                              </p>
                            </div>
                            <button onClick={() => deleteEvent(event.id)} className="text-gray-400 transition-colors hover:text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {dayTodos.map((todo) => (
                        <div key={`todo-${todo.id}`} className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                          <div className="flex items-center gap-2">
                            <CheckSquare size={13} />
                            <p className="truncate font-semibold">{todo.title}</p>
                          </div>
                        </div>
                      ))}

                      {dayEvents.length === 0 && dayTodos.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-350">
                          Vrij
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50/60 p-6 xl:border-l xl:border-t-0">
          <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-pink-400" />
              <p className="text-sm font-bold text-gray-700">Focus vandaag</p>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">
              {selectedEvents.length > 0
                ? `Je hebt vandaag ${selectedEvents.length} agenda-item${selectedEvents.length > 1 ? 's' : ''}. Check vooral wat tijdsgebonden is en laat losse dingen niet je dag breken.`
                : 'Nog geen events vandaag. Mooie kans om diep werk in te plannen of achterstallige taken weg te werken.'}
            </p>
          </div>

          <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays size={14} className="text-gray-400" />
              <p className="text-sm font-bold text-gray-700">Vandaag</p>
            </div>
            <div className="space-y-2">
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-gray-400">Geen events voor vandaag.</p>
              ) : (
                selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-gray-700">{event.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{event.time || 'Hele dag'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              <p className="text-sm font-bold text-gray-700">Todos met datum</p>
            </div>
            <div className="space-y-2">
              {todos.length === 0 ? (
                <p className="text-sm text-gray-400">Geen gedateerde todos deze week.</p>
              ) : (
                todos.slice(0, 6).map((todo) => (
                  <div key={todo.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                    <p className="text-sm font-semibold text-gray-700">{todo.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDate(todo.due_date)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
