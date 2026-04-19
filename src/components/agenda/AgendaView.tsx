'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday, isPast } from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, Divider, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'

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

const TYPE_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  vergadering: { label: 'Vergadering', dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700' },
  deadline: { label: 'Deadline', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700' },
  afspraak: { label: 'Afspraak', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  herinnering: { label: 'Herinnering', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  algemeen: { label: 'Algemeen', dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-700' },
}

const EMPTY_FORM = {
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  type: 'algemeen',
  description: '',
  recurring: '',
}

export default function AgendaView() {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const fetchData = useCallback(async () => {
    setLoading(true)
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')

    const [eventsResponse, todosResponse] = await Promise.all([
      fetch(`/api/events?from=${from}&to=${to}`).then((r) => r.json()),
      fetch('/api/todos?filter=week').then((r) => r.json()),
    ])

    setEvents(eventsResponse.data ?? [])
    setTodos(todosResponse.data ?? [])
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
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  function eventsForDay(day: Date) {
    return events
      .filter((e) => { try { return isSameDay(parseISO(e.date), day) } catch { return false } })
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
  }

  function todosForDay(day: Date) {
    return todos.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), day))
  }

  const selectedEvents = eventsForDay(selectedDay)
  const selectedTodos = todosForDay(selectedDay)
  const weeklyTodoDeadlines = todos.filter((t) => t.due_date)
  const weeklyItems = events.length + weeklyTodoDeadlines.length
  const todayEvents = eventsForDay(new Date()).length

  return (
    <PageShell
      title="Agenda"
      subtitle={`Week van ${format(weekStart, 'd MMMM', { locale: nl })}.`}
      actions={
        <>
          <button
            onClick={() => { const next = addDays(weekStart, -7); setWeekStart(next); setSelectedDay(next) }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => { const today = startOfWeek(new Date(), { weekStartsOn: 1 }); setWeekStart(today); setSelectedDay(new Date()) }}
            className="rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Vandaag
          </button>
          <button
            onClick={() => { const next = addDays(weekStart, 7); setWeekStart(next); setSelectedDay(next) }}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => { setForm((c) => ({ ...c, date: format(selectedDay, 'yyyy-MM-dd') })); setShowAdd((v) => !v) }}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
          >
            <Plus size={14} />
            Nieuw item
          </button>
        </>
      }
    >
      <StatStrip stats={[
        { label: 'Items deze week', value: weeklyItems },
        { label: 'Vandaag', value: todayEvents },
        { label: 'Todos met datum', value: weeklyTodoDeadlines.length },
        { label: format(selectedDay, 'EEEE d MMM', { locale: nl }), value: selectedEvents.length + selectedTodos.length },
      ]} />

      {showAdd && (
        <Panel tone="accent">
          <PanelHeader
            eyebrow="Nieuw agenda-item"
            title="Snel iets plannen"
            action={
              <button onClick={() => setShowAdd(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-white text-on-surface-variant hover:bg-surface-container-low">
                <X size={13} />
              </button>
            }
          />
          <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Titel" className="xl:col-span-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
            <input type="date" value={form.date} onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))} className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none" />
            <input type="time" value={form.time} onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))} className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none" />
            <select value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))} className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none">
              {Object.entries(TYPE_CONFIG).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </select>
            <select value={form.recurring} onChange={(e) => setForm((c) => ({ ...c, recurring: e.target.value }))} className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none">
              <option value="">Niet herhalend</option>
              <option value="dagelijks">Dagelijks</option>
              <option value="wekelijks">Wekelijks</option>
              <option value="maandelijks">Maandelijks</option>
            </select>
            <input value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} placeholder="Omschrijving" className="md:col-span-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={saveEvent} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]">Opslaan</button>
            <button onClick={() => setShowAdd(false)} className="rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low">Annuleer</button>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <PanelHeader eyebrow="Weekoverzicht" title="Kies een dag" />

          {loading ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="h-36 animate-pulse rounded-xl bg-surface-container-low" />
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
              {weekDays.map((day) => {
                const dayEvents = eventsForDay(day)
                const dayTodos = todosForDay(day)
                const total = dayEvents.length + dayTodos.length
                const isSelected = isSameDay(day, selectedDay)
                const today = isToday(day)
                const past = isPast(day) && !today

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-left transition-colors duration-150',
                      isSelected
                        ? 'border-[#202625] bg-accent text-white'
                        : 'border-outline-variant bg-surface-container-low hover:bg-surface-container',
                      past && !isSelected && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div>
                        <p className={cn('text-[10px] font-semibold uppercase tracking-widest', isSelected ? 'text-white/70' : 'text-on-surface-variant/70')}>
                          {format(day, 'EEEEEE', { locale: nl })}
                        </p>
                        <p className={cn('mt-0.5 text-xl font-headline font-extrabold', isSelected ? 'text-white' : 'text-on-surface')}>
                          {format(day, 'd')}
                        </p>
                      </div>
                      {today && (
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-semibold', isSelected ? 'bg-white/15 text-white' : 'bg-surface-container text-on-surface')}>
                          nu
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {total === 0 ? (
                        <p className={cn('text-[10px]', isSelected ? 'text-white/60' : 'text-on-surface-variant/70')}>Leeg</p>
                      ) : (
                        <>
                          {dayEvents.slice(0, 2).map((event) => (
                            <div key={event.id} className="flex items-center gap-1.5">
                              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TYPE_CONFIG[event.type]?.dot ?? TYPE_CONFIG.algemeen.dot)} />
                              <p className={cn('truncate text-[11px] font-medium', isSelected ? 'text-white/90' : 'text-on-surface')}>
                                {event.title}
                              </p>
                            </div>
                          ))}
                          {dayTodos.slice(0, Math.max(0, 2 - dayEvents.length)).map((todo) => (
                            <div key={todo.id} className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                              <p className={cn('truncate text-[11px]', isSelected ? 'text-white/80' : 'text-on-surface')}>
                                {todo.title}
                              </p>
                            </div>
                          ))}
                          {total > 2 && (
                            <p className={cn('text-[10px]', isSelected ? 'text-white/60' : 'text-on-surface-variant')}>
                              +{total - 2} meer
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <Panel>
            <PanelHeader
              eyebrow="Geselecteerde dag"
              title={format(selectedDay, 'EEEE d MMMM', { locale: nl })}
            />

            <div className="mt-3">
              {selectedEvents.length === 0 && selectedTodos.length === 0 ? (
                <EmptyPanel
                  title="Niets gepland"
                  description="Nog niets op deze dag."
                  action={
                    <button
                      onClick={() => { setForm((c) => ({ ...c, date: format(selectedDay, 'yyyy-MM-dd') })); setShowAdd(true) }}
                      className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                    >
                      Voeg item toe
                    </button>
                  }
                />
              ) : (
                <>
                  {selectedEvents.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Afspraken</p>
                      {selectedEvents.map((event, index) => {
                        const typeConfig = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.algemeen
                        return (
                          <div key={event.id}>
                            {index > 0 && <Divider />}
                            <div className="flex items-start gap-2.5 rounded-lg px-2 py-2.5 hover:bg-surface-container-low/50">
                              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', typeConfig.dot)} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="text-sm font-semibold text-on-surface">{event.title}</p>
                                  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-semibold', typeConfig.badge)}>
                                    {typeConfig.label}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-on-surface-variant">
                                  {event.time || 'Hele dag'}{event.contact_name ? ` | ${event.contact_name}` : ''}
                                </p>
                              </div>
                              <button onClick={() => deleteEvent(event.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-red-50 hover:text-red-500">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {selectedTodos.length > 0 && (
                    <div className={selectedEvents.length > 0 ? 'mt-3' : ''}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Taken</p>
                      {selectedTodos.map((todo, index) => (
                        <div key={todo.id}>
                          {index > 0 && <Divider />}
                          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 hover:bg-surface-container-low/50">
                            <CheckSquare size={14} className="shrink-0 text-on-surface-variant" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-on-surface">{todo.title}</p>
                              <p className="text-xs text-on-surface-variant">{todo.priority}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader eyebrow="Deze week" title="Todos met datum" />
            <div className="mt-3">
              {weeklyTodoDeadlines.length === 0 ? (
                <EmptyPanel title="Geen gedateerde todos" description="Geen taken met deadline deze week." />
              ) : (
                weeklyTodoDeadlines.slice(0, 6).map((todo, index) => (
                  <div key={todo.id}>
                    {index > 0 && <Divider />}
                    <div className="flex items-center justify-between rounded-lg px-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-on-surface">{todo.title}</p>
                        <p className="text-xs text-on-surface-variant">
                          {todo.due_date ? format(parseISO(todo.due_date), 'EEEE d MMM', { locale: nl }) : 'Geen datum'}
                        </p>
                      </div>
                      <ActionPill>{todo.priority}</ActionPill>
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
