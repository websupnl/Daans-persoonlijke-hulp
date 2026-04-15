'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, CalendarDays, Clock, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
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

const TYPE_COLORS: Record<string, string> = {
  vergadering: 'bg-blue-50 text-blue-700 border-blue-100',
  deadline:    'bg-red-50 text-red-700 border-red-100',
  afspraak:    'bg-emerald-50 text-emerald-700 border-emerald-100',
  herinnering: 'bg-amber-50 text-amber-700 border-amber-100',
  algemeen:    'bg-gray-50 text-gray-600 border-gray-100',
}

const TYPE_LABELS: Record<string, string> = {
  vergadering: '📅 Vergadering',
  deadline:    '⚠️ Deadline',
  afspraak:    '🤝 Afspraak',
  herinnering: '🔔 Herinnering',
  algemeen:    '📌 Algemeen',
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
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(true)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const from = format(weekStart, 'yyyy-MM-dd')
    const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const res = await fetch(`/api/events?from=${from}&to=${to}`)
    const data = await res.json()
    setEvents(data.data ?? [])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { fetchEvents() }, [fetchEvents])

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
    return events.filter(e => {
      try { return isSameDay(parseISO(e.date), day) } catch { return false }
    })
  }

  const today = new Date()

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-0 bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gradient">Agenda</h1>
          <p className="text-gray-400 text-sm mt-0.5 font-medium">
            Week van {format(weekStart, 'd MMMM', { locale: nl })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-pink-200 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="h-9 px-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:border-pink-200 hover:text-gray-800 transition-colors"
          >
            Vandaag
          </button>
          <button
            onClick={() => setWeekStart(w => addDays(w, 7))}
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:border-pink-200 hover:text-gray-800 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: GRAD }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-6">
        {/* Add form */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gradient">Nieuw event</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Titel *"
                className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
              />
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
              />
              <input
                type="time"
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                placeholder="Tijd (optioneel)"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
              />
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
              >
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Omschrijving (optioneel)"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveEvent}
                disabled={!form.title.trim()}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ background: GRAD }}
              >
                Opslaan
              </button>
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-sm font-medium transition-colors"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {/* Week grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {weekDays.map(day => {
              const dayEvents = eventsForDay(day)
              const isToday = isSameDay(day, today)

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'rounded-2xl border p-4 transition-all',
                    isToday ? 'border-pink-200 bg-gradient-to-r from-orange-50/50 via-pink-50/50 to-violet-50/50' : 'border-gray-100 bg-white'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold',
                        isToday ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                      )}
                      style={isToday ? { background: GRAD } : undefined}
                    >
                      {format(day, 'd')}
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-semibold capitalize',
                        isToday ? 'text-gradient' : 'text-gray-500'
                      )}>
                        {format(day, 'EEEE', { locale: nl })}
                      </p>
                    </div>
                    {dayEvents.length === 0 && (
                      <span className="ml-auto text-xs text-gray-300 font-medium">vrij</span>
                    )}
                  </div>

                  {dayEvents.length > 0 && (
                    <div className="flex flex-col gap-1.5 ml-11">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className={cn(
                            'flex items-start gap-2.5 px-3 py-2 rounded-xl border text-sm group',
                            TYPE_COLORS[event.type] ?? TYPE_COLORS.algemeen
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {event.time && (
                                <span className="flex items-center gap-1 text-xs opacity-60 shrink-0">
                                  <Clock size={10} />
                                  {event.time}
                                </span>
                              )}
                              <span className="font-semibold truncate">{event.title}</span>
                            </div>
                            {event.description && (
                              <p className="text-xs opacity-60 mt-0.5 truncate">{event.description}</p>
                            )}
                            {(event.contact_name || event.project_title) && (
                              <p className="text-xs opacity-60 mt-0.5">
                                {event.contact_name && `👤 ${event.contact_name}`}
                                {event.project_title && ` · 📁 ${event.project_title}`}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={12} />
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
