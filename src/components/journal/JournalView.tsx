'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function JournalView() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [newGratitude, setNewGratitude] = useState('')
  const [recentDates, setRecentDates] = useState<string[]>([])

  const fetchEntry = useCallback(async (d: string) => {
    const res = await fetch(`/api/journal?date=${d}`)
    const data = await res.json()
    setEntry(data.data || { date: d, content: '', mood: undefined, energy: undefined, gratitude: [], highlights: '' })
  }, [])

  useEffect(() => { fetchEntry(date) }, [date, fetchEntry])

  // Recent dates
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

  // Debounced text save
  const debouncedSave = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>
      return (updates: Partial<JournalEntry>) => {
        clearTimeout(timer)
        timer = setTimeout(() => save(updates), 800)
      }
    })(),
    [save]
  )

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
    const list = entry.gratitude.filter((_, idx) => idx !== i)
    save({ gratitude: list })
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex h-screen">
      {/* Left: date selector */}
      <div className="w-52 border-r border-white/5 flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-white/5">
          <h1 className="text-base font-semibold text-white">Dagboek</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2 px-1">Recente dagen</p>
          {recentDates.map(d => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-xs mb-0.5 transition-colors', d === date ? 'bg-brand-600/20 text-brand-400' : 'text-slate-400 hover:bg-white/5')}
            >
              <span className="capitalize">{format(new Date(d + 'T12:00:00'), 'EEEE', { locale: nl })}</span>
              <br />
              <span className="text-slate-600 text-[10px]">{format(new Date(d + 'T12:00:00'), 'd MMM', { locale: nl })}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {/* Date nav */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 text-center">
              <h2 className="text-base font-semibold text-white capitalize">
                {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM yyyy', { locale: nl })}
              </h2>
              {isToday && <span className="text-[10px] text-brand-400">Vandaag</span>}
            </div>
            <button onClick={() => navigate(1)} disabled={isToday} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>

          {entry && (
            <div className="space-y-5">
              {/* Mood & Energy */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Smile size={14} className="text-brand-400" />
                    <p className="text-xs font-medium text-slate-400">Stemming</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => save({ mood: v })} className={cn('flex-1 h-8 rounded-lg text-sm transition-all', entry.mood === v ? 'bg-brand-600/30 text-brand-400 scale-105' : 'bg-white/5 text-slate-600 hover:bg-white/10')}>
                        {['😔','😕','😐','🙂','😄'][v-1]}
                      </button>
                    ))}
                  </div>
                  {entry.mood && <p className="text-[10px] text-slate-600 mt-1.5 text-center">{MOOD_LABELS[entry.mood]}</p>}
                </div>

                <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className="text-amber-400" />
                    <p className="text-xs font-medium text-slate-400">Energie</p>
                  </div>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(v => (
                      <button key={v} onClick={() => save({ energy: v })} className={cn('flex-1 h-8 rounded-lg text-sm transition-all', entry.energy === v ? 'bg-amber-950/40 text-amber-400 scale-105' : 'bg-white/5 text-slate-600 hover:bg-white/10')}>
                        {v}
                      </button>
                    ))}
                  </div>
                  {entry.energy && <p className="text-[10px] text-slate-600 mt-1.5 text-center">{ENERGY_LABELS[entry.energy]}</p>}
                </div>
              </div>

              {/* Main content */}
              <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-slate-600 mb-2">Dagboek</p>
                <textarea
                  value={entry.content}
                  onChange={e => { setEntry(prev => prev ? { ...prev, content: e.target.value } : prev); debouncedSave({ content: e.target.value }) }}
                  placeholder="Hoe was je dag? Wat heb je gedaan, geleerd, gevoeld?"
                  className="w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-700 outline-none resize-none min-h-[140px] leading-relaxed"
                />
                {saving && <p className="text-[10px] text-slate-700 text-right">Opslaan...</p>}
              </div>

              {/* Highlights */}
              <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-slate-600 mb-2">Hoogtepunten</p>
                <textarea
                  value={entry.highlights || ''}
                  onChange={e => { setEntry(prev => prev ? { ...prev, highlights: e.target.value } : prev); debouncedSave({ highlights: e.target.value }) }}
                  placeholder="Wat was het beste van vandaag?"
                  className="w-full bg-transparent text-sm text-slate-300 placeholder:text-slate-700 outline-none resize-none min-h-[60px] leading-relaxed"
                />
              </div>

              {/* Gratitude */}
              <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
                <p className="text-xs text-slate-600 mb-3">Dankbaarheid</p>
                <div className="space-y-2 mb-3">
                  {entry.gratitude.map((g, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-brand-400 text-sm">✦</span>
                      <span className="text-sm text-slate-300 flex-1">{g}</span>
                      <button onClick={() => removeGratitude(i)} className="text-slate-700 hover:text-red-400 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newGratitude}
                    onChange={e => setNewGratitude(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGratitude()}
                    placeholder="Waar ben je dankbaar voor?"
                    className="flex-1 bg-white/5 text-xs text-slate-300 placeholder:text-slate-700 rounded-lg px-3 py-1.5 outline-none"
                  />
                  <button onClick={addGratitude} className="p-1.5 rounded-lg bg-brand-600/20 text-brand-400 hover:bg-brand-600/30 transition-colors">
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
