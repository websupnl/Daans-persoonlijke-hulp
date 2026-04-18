'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { format, addDays, startOfWeek, isSameDay, parseISO, isToday, isPast } from 'date-fns'
import { nl } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'

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
  vergadering: { label: 'Vergadering', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
  deadline: { label: 'Deadline', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  afspraak: { label: 'Afspraak', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  herinnering: { label: 'Herinnering', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  algemeen: { label: 'Algemeen', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700' },
}

const EMPTY_FORM = {
  title: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  type: 'algemeen',
  description: '',
  recurring: '',
}

function formatEventMeta(event: AgendaEvent) {
  const parts = [event.time || 'Hele dag']
  if (event.contact_name) parts.push(event.contact_name)
  if (event.description) parts.push(event.description)
  return parts.join(' | ')
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
      fetch(`/api/events?from=${from}&to=${to}`).then((response) => response.json()),
      fetch('/api/todos?filter=week').then((response) => response.json()),
    ])

    setEvents(eventsResponse.data ?? [])
    setTodos(todosResponse.data ?? [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
    setEvents((previous) => previous.filter((event) => event.id !== id))
  }

  function eventsForDay(day: Date) {
    return events
      .filter((event) => {
        try {
          return isSameDay(parseISO(event.date), day)
        } catch {
          return false
        }
      })
      .sort((left, right) => (left.time ?? '99:99').localeCompare(right.time ?? '99:99'))
  }

  function todosForDay(day: Date) {
    return todos.filter((todo) => todo.due_date && isSameDay(parseISO(todo.due_date), day))
  }

  const selectedEvents = eventsForDay(selectedDay)
  const selectedTodos = todosForDay(selectedDay)
  const weeklyTodoDeadlines = todos.filter((todo) => todo.due_date)
  const weeklyItems = events.length + weeklyTodoDeadlines.length
  const todayEvents = eventsForDay(new Date()).length

  return (
    <PageShell
      title="Agenda"
      subtitle={`Week van ${format(weekStart, 'd MMMM', { locale: nl })}. Je planning moet hier rust geven en niet als een rommelige kalenderdump voelen.`}
      actions={
        <>
          <button
            onClick={() => {
              const next = addDays(weekStart, -7)
              setWeekStart(next)
              setSelectedDay(next)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              const today = startOfWeek(new Date(), { weekStartsOn: 1 })
              setWeekStart(today)
              setSelectedDay(new Date())
            }}
            className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            Vandaag
          </button>
          <button
            onClick={() => {
              const next = addDays(weekStart, 7)
              setWeekStart(next)
              setSelectedDay(next)
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-on-surface transition-colors hover:bg-surface-container-low"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => {
              setForm((current) => ({ ...current, date: format(selectedDay, 'yyyy-MM-dd') }))
              setShowAdd((value) => !value)
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
          >
            <Plus size={15} />
            Nieuw item
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Items deze week" value={weeklyItems} meta={`${events.length} afspraken en ${weeklyTodoDeadlines.length} taken`} icon={<CalendarDays size={18} />} />
        <MetricTile label="Vandaag" value={todayEvents} meta="Afspraken vandaag" icon={<Clock3 size={18} />} />
        <MetricTile label="Todos met datum" value={weeklyTodoDeadlines.length} meta="Binnen deze week zichtbaar" icon={<CheckSquare size={18} />} />
        <MetricTile label="Geselecteerde dag" value={selectedEvents.length + selectedTodos.length} meta={format(selectedDay, 'EEEE d MMM', { locale: nl })} icon={<CalendarDays size={18} />} />
      </div>

      {showAdd && (
        <Panel tone="accent">
          <PanelHeader
            eyebrow="Nieuw agenda-item"
            title="Snel iets plannen"
            description="Voeg direct een afspraak of herinnering toe zonder eerst een los formulier in te duiken."
            action={
              <button
                onClick={() => setShowAdd(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <X size={14} />
              </button>
            }
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Titel"
              className="xl:col-span-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
            />
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none"
            />
            <input
              type="time"
              value={form.time}
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none"
            />
            <select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none"
            >
              {Object.entries(TYPE_CONFIG).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              value={form.recurring}
              onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.value }))}
              className="rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none"
            >
              <option value="">Niet herhalend</option>
              <option value="dagelijks">Dagelijks</option>
              <option value="wekelijks">Wekelijks</option>
              <option value="maandelijks">Maandelijks</option>
            </select>
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Omschrijving of context"
              className="md:col-span-2 xl:col-span-2 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={saveEvent}
              className="rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
            >
              Opslaan
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
            >
              Annuleer
            </button>
          </div>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              eyebrow="Weekoverzicht"
              title="Kies een dag"
              description="Je agenda moet direct scanbaar zijn: welke dagen zitten vol, welke zijn leeg, en waar loopt planning door elkaar."
            />

            {loading ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {weekDays.map((day) => (
                  <div key={day.toISOString()} className="min-h-[168px] rounded-[24px] border border-black/5 bg-surface-container-low animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                {weekDays.map((day) => {
                  const dayEvents = eventsForDay(day)
                  const dayTodos = todosForDay(day)
                  const total = dayEvents.length + dayTodos.length
                  const selected = isSameDay(day, selectedDay)
                  const today = isToday(day)
                  const past = isPast(day) && !today

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'rounded-[26px] border px-4 py-4 text-left transition-all duration-200',
                        selected
                          ? 'border-[#202625] bg-[#202625] text-white shadow-[0_24px_60px_-34px_rgba(18,22,21,0.42)]'
                          : 'border-black/5 bg-white hover:-translate-y-0.5 hover:bg-surface-container-low',
                        past && !selected && 'opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.16em]', selected ? 'text-white/70' : 'text-on-surface-variant/75')}>
                            {format(day, 'EEEEEE', { locale: nl })}
                          </p>
                          <p className={cn('mt-1 text-2xl font-headline font-extrabold tracking-tight', selected ? 'text-white' : 'text-on-surface')}>
                            {format(day, 'd')}
                          </p>
                        </div>
                        {today && (
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', selected ? 'bg-white/12 text-white' : 'bg-surface-container-low text-on-surface')}>
                            Vandaag
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {dayEvents.length > 0 && <ActionPill className={selected ? 'border-white/10 bg-white/10 text-white/75 shadow-none' : ''}>{dayEvents.length} events</ActionPill>}
                        {dayTodos.length > 0 && <ActionPill className={selected ? 'border-white/10 bg-white/10 text-white/75 shadow-none' : ''}>{dayTodos.length} todo's</ActionPill>}
                      </div>

                      <div className="mt-4 space-y-2">
                        {total === 0 ? (
                          <p className={cn('text-xs leading-5', selected ? 'text-white/65' : 'text-on-surface-variant')}>
                            Rustige dag. Nog niets gepland.
                          </p>
                        ) : (
                          <>
                            {dayEvents.slice(0, 2).map((event) => (
                              <div key={event.id} className="flex items-start gap-2">
                                <span className={cn('mt-1.5 h-2 w-2 rounded-full', TYPE_CONFIG[event.type]?.dot ?? TYPE_CONFIG.algemeen.dot)} />
                                <div className="min-w-0">
                                  <p className={cn('truncate text-sm font-semibold', selected ? 'text-white' : 'text-on-surface')}>
                                    {event.title}
                                  </p>
                                  <p className={cn('text-[11px]', selected ? 'text-white/70' : 'text-on-surface-variant')}>
                                    {event.time || 'Hele dag'}
                                  </p>
                                </div>
                              </div>
                            ))}
                            {dayTodos.slice(0, Math.max(0, 2 - dayEvents.length)).map((todo) => (
                              <div key={todo.id} className="flex items-start gap-2">
                                <span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500" />
                                <p className={cn('truncate text-sm', selected ? 'text-white/85' : 'text-on-surface')}>
                                  {todo.title}
                                </p>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Panel>

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Weekritme"
              title="Waar de spanning zit"
              description="Een planner is pas goed als hij laat zien waar je week druk wordt en waar nog lucht zit."
            />

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {weekDays.map((day) => {
                const dayEvents = eventsForDay(day)
                const dayTodos = todosForDay(day)
                const total = dayEvents.length + dayTodos.length

                return (
                  <div key={day.toISOString()} className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                          {format(day, 'EEEE', { locale: nl })}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">
                          {total === 0 ? 'Leeg' : `${total} item${total !== 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <span className={cn('h-3 w-3 rounded-full', total === 0 ? 'bg-surface-container-high' : total >= 4 ? 'bg-[#a55a2c]' : 'bg-[#202625]')} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel>
            <PanelHeader
              eyebrow="Geselecteerde dag"
              title={format(selectedDay, 'EEEE d MMMM', { locale: nl })}
              description={`${selectedEvents.length} afspraken en ${selectedTodos.length} taken op deze dag.`}
            />

            <div className="mt-5 space-y-5">
              {selectedEvents.length === 0 && selectedTodos.length === 0 ? (
                <EmptyPanel
                  title="Niets gepland"
                  description="Dat mag ook. Als je hier iets toevoegt, blijft de rechterrail direct de bron van waarheid voor deze dag."
                  action={
                    <button
                      onClick={() => {
                        setForm((current) => ({ ...current, date: format(selectedDay, 'yyyy-MM-dd') }))
                        setShowAdd(true)
                      }}
                      className="rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                    >
                      Voeg item toe
                    </button>
                  }
                />
              ) : (
                <>
                  {selectedEvents.length > 0 && (
                    <section className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                        Afspraken
                      </p>
                      {selectedEvents.map((event) => {
                        const typeConfig = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.algemeen
                        return (
                          <div key={event.id} className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
                            <div className="flex items-start gap-3">
                              <span className={cn('mt-1.5 h-2.5 w-2.5 rounded-full', typeConfig.dot)} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-on-surface">{event.title}</p>
                                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', typeConfig.badge)}>
                                    {typeConfig.label}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                                  {formatEventMeta(event)}
                                </p>
                              </div>
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-[#a55a2c]"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </section>
                  )}

                  {selectedTodos.length > 0 && (
                    <section className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/75">
                        Taken met deadline
                      </p>
                      {selectedTodos.map((todo) => (
                        <div key={todo.id} className="rounded-[24px] border border-black/5 bg-white/70 px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface">
                              <CheckSquare size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-on-surface">{todo.title}</p>
                              <p className="mt-1 text-xs text-on-surface-variant">
                                Prioriteit: {todo.priority}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </section>
                  )}
                </>
              )}
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader
              eyebrow="Deze week"
              title="Todos met datum"
              description="Taken met een datum horen mee te bewegen met je planning, niet verstopt te zitten op een losse lijst."
            />

            <div className="mt-5 space-y-3">
              {weeklyTodoDeadlines.length === 0 ? (
                <EmptyPanel
                  title="Geen gedateerde todos"
                  description="Dat geeft lucht. Als een taak echt op tijd moet gebeuren, hoort hij hier zichtbaar te worden."
                />
              ) : (
                weeklyTodoDeadlines.slice(0, 6).map((todo) => (
                  <div key={todo.id} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">{todo.title}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
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
