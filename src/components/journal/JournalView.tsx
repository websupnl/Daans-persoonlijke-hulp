'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Smile, Zap, Plus, X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JournalEntry {
  id?: number
  date: string
  content: string
  mood?: number
  energy?: number
  gratitude: string[]
  highlights?: string
}

const MOOD_LABELS = ['', 'Slecht', 'Matig', 'Oké', 'Goed', 'Top']
const ENERGY_LABELS = ['', 'Leeg', 'Laag', 'Oké', 'Goed', 'Top']
const DAY_PROMPTS = [
  'Wat gaf vandaag de meeste energie?',
  'Waar liep je op vast?',
  'Wat wil je morgen slimmer aanpakken?',
]
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function JournalView() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [newGratitude, setNewGratitude] = useState('')
  const [recentDates, setRecentDates] = useState<string[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEntry = useCallback(async (currentDate: string) => {
    const res = await fetch(`/api/journal?date=${currentDate}`)
    const data = await res.json()
    setEntry(data.data || { date: currentDate, content: '', mood: undefined, energy: undefined, gratitude: [], highlights: '' })
  }, [])

  useEffect(() => { fetchEntry(date) }, [date, fetchEntry])

  useEffect(() => {
    const dates = Array.from({ length: 14 }, (_, index) => format(subDays(new Date(), index), 'yyyy-MM-dd'))
    setRecentDates(dates)
  }, [])

  const save = useCallback(async (updates: Partial<JournalEntry>) => {
    if (!entry) return
    setSaving(true)
    const updated = { ...entry, ...updates }
    setEntry(updated)
    await fetch('/api/journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setTimeout(() => setSaving(false), 500)
  }, [entry])

  const debouncedSave = useCallback((updates: Partial<JournalEntry>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => save(updates), 700)
  }, [save])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const navigate = (delta: number) => {
    const value = new Date(`${date}T12:00:00`)
    value.setDate(value.getDate() + delta)
    if (value <= new Date()) setDate(format(value, 'yyyy-MM-dd'))
  }

  const addGratitude = () => {
    if (!newGratitude.trim() || !entry) return
    const gratitude = [...entry.gratitude, newGratitude.trim()]
    setNewGratitude('')
    save({ gratitude })
  }

  const removeGratitude = (index: number) => {
    if (!entry) return
    save({ gratitude: entry.gratitude.filter((_, currentIndex) => currentIndex !== index) })
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex min-h-full flex-col bg-white lg:flex-row">
      <div className="w-full border-b border-gray-100 bg-gray-50/60 lg:w-72 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-gray-100 px-5 py-5">
          <h1 className="text-xl font-extrabold text-gradient">Dagboek</h1>
          <p className="mt-1 text-xs font-medium text-gray-400">Snelle reflectie met vaste structuur</p>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-pink-400" />
              <p className="text-sm font-bold text-gray-700">Prompts</p>
            </div>
            <div className="space-y-2">
              {DAY_PROMPTS.map((prompt) => (
                <p key={prompt} className="text-sm leading-relaxed text-gray-600">{prompt}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto px-4 pb-4 lg:overflow-y-auto lg:overflow-x-hidden">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">Recente dagen</p>
          <div className="flex gap-2 lg:block">
            {recentDates.map((currentDate) => (
              <button
                key={currentDate}
                onClick={() => setDate(currentDate)}
                className={cn('min-w-[120px] rounded-2xl px-3 py-3 text-left text-xs font-medium transition-all lg:mb-1 lg:w-full', currentDate === date ? 'text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-100')}
                style={currentDate === date ? { background: GRAD } : undefined}
              >
                <span className="capitalize">{format(new Date(`${currentDate}T12:00:00`), 'EEEE', { locale: nl })}</span>
                <br />
                <span className={cn('text-[10px]', currentDate === date ? 'text-white/80' : 'text-gray-400')}>
                  {format(new Date(`${currentDate}T12:00:00`), 'd MMM', { locale: nl })}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
          <div className="mb-6 flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 text-center">
              <h2 className="text-base font-extrabold capitalize text-gradient">
                {format(new Date(`${date}T12:00:00`), 'EEEE d MMMM yyyy', { locale: nl })}
              </h2>
              {isToday && <span className="text-[10px] font-semibold text-pink-400">Vandaag</span>}
            </div>
            <button onClick={() => navigate(1)} disabled={isToday} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>

          {entry && (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-2 text-sm font-bold text-gray-700">Hoe was je dag?</p>
                  <textarea
                    value={entry.content}
                    onChange={(e) => {
                      setEntry((prev) => prev ? { ...prev, content: e.target.value } : prev)
                      debouncedSave({ content: e.target.value })
                    }}
                    placeholder="Schrijf rauw op wat er gebeurde, wat je dacht en wat opviel."
                    className="min-h-[220px] w-full resize-none bg-transparent text-sm leading-relaxed text-gray-700 outline-none placeholder:text-gray-300"
                  />
                  {saving && <p className="text-right text-[10px] font-medium text-gray-300">Opslaan...</p>}
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-2 text-sm font-bold text-gray-700">Hoogtepunten en lessen</p>
                  <textarea
                    value={entry.highlights || ''}
                    onChange={(e) => {
                      setEntry((prev) => prev ? { ...prev, highlights: e.target.value } : prev)
                      debouncedSave({ highlights: e.target.value })
                    }}
                    placeholder="Wat was het beste stuk van vandaag? Wat neem je mee naar morgen?"
                    className="min-h-[120px] w-full resize-none bg-transparent text-sm leading-relaxed text-gray-700 outline-none placeholder:text-gray-300"
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Smile size={14} className="text-pink-400" />
                    <p className="text-sm font-bold text-gray-700">Stemming</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => save({ mood: value })}
                        className={cn('rounded-2xl py-2 text-sm transition-all', entry.mood === value ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-500')}
                        style={entry.mood === value ? { background: GRAD } : undefined}
                      >
                        {['😔', '😕', '😐', '🙂', '😄'][value - 1]}
                      </button>
                    ))}
                  </div>
                  {entry.mood && <p className="mt-2 text-center text-xs text-gray-400">{MOOD_LABELS[entry.mood]}</p>}
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Zap size={14} className="text-amber-400" />
                    <p className="text-sm font-bold text-gray-700">Energie</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => save({ energy: value })}
                        className={cn('rounded-2xl py-2 text-sm font-bold transition-all', entry.energy === value ? 'text-white shadow-sm' : 'bg-gray-50 text-gray-500')}
                        style={entry.energy === value ? { background: GRAD } : undefined}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                  {entry.energy && <p className="mt-2 text-center text-xs text-gray-400">{ENERGY_LABELS[entry.energy]}</p>}
                </div>

                <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-sm font-bold text-gray-700">Dankbaarheid</p>
                  <div className="space-y-2">
                    {entry.gratitude.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2">
                        <span className="text-pink-400">✦</span>
                        <span className="flex-1 text-sm text-gray-600">{item}</span>
                        <button onClick={() => removeGratitude(index)} className="text-gray-300 hover:text-red-400">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newGratitude}
                      onChange={(e) => setNewGratitude(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addGratitude()}
                      placeholder="Waar ben je dankbaar voor?"
                      className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none"
                    />
                    <button onClick={addGratitude} className="rounded-2xl px-3 text-white shadow-sm" style={{ background: GRAD }}>
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
