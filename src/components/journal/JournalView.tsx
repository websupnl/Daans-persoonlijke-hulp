'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Smile, Zap, Plus, X } from 'lucide-react'
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

const MOOD_LABELS = ['', '😔 Slecht', '😕 Matig', '😐 Oké', '🙂 Goed', '😄 Super']
const ENERGY_LABELS = ['', '🔋 Leeg', '⚡ Laag', '💡 Oké', '⚡⚡ Goed', '🚀 Top']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function JournalView() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [newGratitude, setNewGratitude] = useState('')
  const [recentDates, setRecentDates] = useState<string[]>([])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEntry = useCallback(async (d: string) => {
    const res = await fetch(`/api/journal?date=${d}`)
    const data = await res.json()
    setEntry(data.data || { date: d, content: '', mood: undefined, energy: undefined, gratitude: [], highlights: '' })
  }, [])

  useEffect(() => { fetchEntry(date) }, [date, fetchEntry])

  useEffect(() => {
    const dates = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'))
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
    saveTimerRef.current = setTimeout(() => save(updates), 800)
  }, [save])

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [])

  const navigate = (delta: number) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    if (d <= new Date()) setDate(format(d, 'yyyy-MM-dd'))
  }

  const addGratitude = () => {
    if (!newGratitude.trim() || !entry) return
    const list = [...entry.gratitude, newGratitude.trim()]
    setNewGratitude('')
    save({ gratitude: list })
  }

  const removeGratitude = (i: number) => {
    if (!entry) return
    save({ gratitude: entry.gratitude.filter((_, idx) => idx !== i) })
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex min-h-full flex-col bg-white lg:flex-row">
      {/* Left: date selector */}
      <div className="flex w-full flex-col border-b border-gray-100 bg-white lg:w-52 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="border-b border-gray-100 px-4 py-5">
          <h1 className="text-base font-extrabold text-gradient">Dagboek</h1>
        </div>
        <div className="flex-1 overflow-x-auto px-3 py-3 lg:overflow-y-auto lg:overflow-x-hidden">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">Recente dagen</p>
          <div className="flex gap-2 lg:block lg:space-y-0.5">
          {recentDates.map(d => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={cn('min-w-[112px] rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all lg:mb-0.5 lg:w-full', d === date ? 'text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50')}
              style={d === date ? { background: GRAD } : {}}
            >
              <span className="capitalize">{format(new Date(d + 'T12:00:00'), 'EEEE', { locale: nl })}</span>
              <br />
              <span className={cn('text-[10px]', d === date ? 'text-white/80' : 'text-gray-400')}>
                {format(new Date(d + 'T12:00:00'), 'd MMM', { locale: nl })}
              </span>
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Main editor */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-6">
          {/* Date nav */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 text-center">
              <h2 className="text-base font-extrabold text-gradient capitalize">
                {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: nl })}
              </h2>
              {isToday && <span className="text-[10px] text-pink-400 font-semibold">Vandaag</span>}
            </div>
            <button onClick={() => navigate(1)} disabled={isToday} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>

          {entry && (
            <div className="space-y-4">
              {/* Mood & Energy */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Smile size={14} className="text-pink-400" />
                    <p className="text-xs font-semibold text-gray-500">Stemming</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(v => (
                      <button
                        key={v}
                        onClick={() => save({ mood: v })}
                        className={cn('flex-1 h-9 rounded-xl text-sm transition-all', entry.mood === v ? 'scale-110 shadow-sm' : 'bg-gray-50 hover:bg-gray-100')}
                        style={entry.mood === v ? { background: GRAD } : {}}
                      >
                        {['😔','😕','😐','🙂','😄'][v-1]}
                      </button>
                    ))}
                  </div>
                  {entry.mood && <p className="text-[10px] text-gray-400 mt-1.5 text-center font-medium">{MOOD_LABELS[entry.mood]}</p>}
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className="text-amber-400" />
                    <p className="text-xs font-semibold text-gray-500">Energie</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(v => (
                      <button
                        key={v}
                        onClick={() => save({ energy: v })}
                        className={cn('flex-1 h-9 rounded-xl text-sm font-bold transition-all', entry.energy === v ? 'text-white scale-110 shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')}
                        style={entry.energy === v ? { background: GRAD } : {}}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {entry.energy && <p className="text-[10px] text-gray-400 mt-1.5 text-center font-medium">{ENERGY_LABELS[entry.energy]}</p>}
                </div>
              </div>

              {/* Main content */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gradient mb-2">Dagboek</p>
                <textarea
                  value={entry.content}
                  onChange={e => { setEntry(prev => prev ? { ...prev, content: e.target.value } : prev); debouncedSave({ content: e.target.value }) }}
                  placeholder="Hoe was je dag? Wat heb je gedaan, geleerd, gevoeld?"
                  className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none min-h-[140px] leading-relaxed"
                />
                {saving && <p className="text-[10px] text-gray-300 text-right font-medium">Opslaan...</p>}
              </div>

              {/* Highlights */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gradient mb-2">Hoogtepunten</p>
                <textarea
                  value={entry.highlights || ''}
                  onChange={e => { setEntry(prev => prev ? { ...prev, highlights: e.target.value } : prev); debouncedSave({ highlights: e.target.value }) }}
                  placeholder="Wat was het beste van vandaag?"
                  className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-300 outline-none resize-none min-h-[60px] leading-relaxed"
                />
              </div>

              {/* Gratitude */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gradient mb-3">Dankbaarheid</p>
                <div className="space-y-2 mb-3">
                  {entry.gratitude.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-pink-400 text-sm">✦</span>
                      <span className="text-sm text-gray-600 font-medium flex-1">{g}</span>
                      <button onClick={() => removeGratitude(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={newGratitude}
                    onChange={e => setNewGratitude(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGratitude()}
                    placeholder="Waar ben je dankbaar voor?"
                    className="flex-1 bg-gray-50 text-xs text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-100"
                  />
                  <button
                    onClick={addGratitude}
                    className="p-2 rounded-xl text-white shadow-sm transition-opacity hover:opacity-90"
                    style={{ background: GRAD }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
