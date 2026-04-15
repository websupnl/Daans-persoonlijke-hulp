'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

interface Event {
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

const TYPE_COLORS: Record<string, string> = {
  vergadering: 'bg-blue-950/60 text-blue-300 border-blue-800/40',
  deadline: 'bg-red-950/60 text-red-300 border-red-800/40',
  afspraak: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
  herinnering: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  algemeen: 'bg-white/5 text-slate-300 border-white/10',
}

const TYPE_LABELS: Record<string, string> = {
  vergadering: '📅 Vergadering',
  deadline: '⚠️ Deadline',
  afspraak: '🤝 Afspraak',
  herinnering: '🔔 Herinnering',
  algemeen: '📌 Algemeen',
}

const EMPTY_FORM = { title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '', type: 'algemeen', description: '', duration: 60 }

export default function AgendaView() {
  const [events, setEvents] = useState<Event[]>([])
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  useEffect(() => {
    fetchEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  async function fetchEvents() {
    setLoading(true)
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const res = await fetch(`/api/events?from=${from}&to=${to}`)
    const data = await res.json()
    setEvents(data.data || [])
    setLoading(false)
  }

  async function saveEvent() {
    if (!form.title.trim() || !form.date) return
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ ...EMPTY_FORM })
    setShowAdd(false)
    fetchEvents()
  }

  async function deleteEvent(id: number) {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  function eventsForDay(day: Date) {
    return events.filter(e => isSameDay(parseISO(e.date), day))
  }

  const today = new Date()

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-brand-400" />
          <div>
            <h1 className="text-sm font-semibold text-white">Agenda</h1>
            <p className="text-[11px] text-slate-500">
              Week van {format(weekStart, 'd MMMM', { locale: nl })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => addDays(w, -7))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
            Vandaag
          </button>
          <button onClick={() => setWeekStart(w => addDays(w, 7))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="w-7 h-7 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center hover:bg-brand-600/30 transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mx-4 my-3 p-4 bg-[#13151c] border border-white/10 rounded-xl text-xs space-y-2.5 animate-fade-in flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Titel *"
              className="col-span-2 bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 outline-none"
            />
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="bg-white/5 text-slate-300 rounded px-2.5 py-1.5 outline-none"
            />
            <input
              type="time"
              value={form.time}
              onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
              placeholder="Tijd"
              className="bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 outline-none"
            />
          </div>
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            className="w-full bg-white/5 text-slate-300 rounded px-2.5 py-1.5 outline-none"
          >
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <input
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Omschrijving (optioneel)"
            className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 outline-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-1.5 rounded bg-white/5 text-slate-500">Annuleer</button>
            <button onClick={saveEvent} className="flex-1 py-1.5 rounded bg-brand-600 text-white">Opslaan</button>
          </div>
        </div>
      )}

      {/* Week grid */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {weekDays.map(day => {
              const dayEvents = eventsForDay(day)
              const isToday = isSameDay(day, today)

              return (
                <div key={day.toISOString()} className={cn('rounded-xl border p-3', isToday ? 'border-brand-800/40 bg-brand-950/20' : 'border-white/5 bg-[#13151c]')}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold', isToday ? 'bg-brand-600 text-white' : 'bg-white/5 text-slate-400')}>
                      {format(day, 'd')}
                    </div>
                    <div>
                      <p className={cn('text-xs font-medium capitalize', isToday ? 'text-brand-300' : 'text-slate-400')}>
                        {format(day, 'EEEE', { locale: nl })}
                      </p>
                    </div>
                    {dayEvents.length === 0 && (
                      <p className="text-[10px] text-slate-700 ml-auto">vrij</p>
                    )}
                  </div>

                  {dayEvents.length > 0 && (
                    <div className="space-y-1.5 ml-9">
                      {dayEvents.map(event => (
                        <div key={event.id} className={cn('flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs group', TYPE_COLORS[event.type] || TYPE_COLORS.algemeen)}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {event.time && (
                                <span className="flex items-center gap-0.5 text-[10px] opacity-70">
                                  <Clock size={9} />
                                  {event.time}
                                </span>
                              )}
                              <span className="font-medium truncate">{event.title}</span>
                            </div>
                            {event.description && (
                              <p className="text-[10px] opacity-60 mt-0.5 truncate">{event.description}</p>
                            )}
                            {(event.contact_name || event.project_title) && (
                              <p className="text-[10px] opacity-60 mt-0.5">
                                {event.contact_name && `👤 ${event.contact_name}`}
                                {event.project_title && ` · ${event.project_title}`}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
