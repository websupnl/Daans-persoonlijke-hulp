'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subDays } from 'date-fns'

interface Habit {
  id: number
  name: string
  description?: string
  frequency: string
  color: string
  icon: string
  completedToday: boolean
  streak: number
  logs: Array<{ logged_date: string }>
}

const ICONS = ['⭐', '💪', '🏃', '📚', '🧘', '💧', '🥗', '😴', '💊', '🎯', '✍️', '🚴']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', icon: '⭐', color: '#ec4899', frequency: 'dagelijks' })

  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))

  const fetchHabits = async () => {
    const res = await fetch('/api/habits')
    const data = await res.json()
    setHabits(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchHabits() }, [])

  async function toggleHabit(habit: Habit) {
    const today = format(new Date(), 'yyyy-MM-dd')
    if (habit.completedToday) {
      await fetch(`/api/habits/log?habit_id=${habit.id}&date=${today}`, { method: 'DELETE' })
    } else {
      await fetch('/api/habits/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit_id: habit.id }),
      })
    }
    fetchHabits()
  }

  async function addHabit() {
    if (!form.name.trim()) return
    await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ name: '', icon: '⭐', color: '#ec4899', frequency: 'dagelijks' })
    setShowAdd(false)
    fetchHabits()
  }

  const completedToday = habits.filter(h => h.completedToday).length

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-gradient">Gewoontes</h1>
          <p className="text-xs text-gray-400 mt-0.5 font-medium">{completedToday}/{habits.length} vandaag gedaan</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
          style={{ background: GRAD }}
        >
          <Plus size={14} />
          Toevoegen
        </button>
      </div>

      {showAdd && (
        <div className="mx-6 mt-4 p-4 bg-gray-50 border border-gray-200 rounded-2xl animate-fade-in space-y-3">
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Naam gewoonte *" className="w-full bg-white text-sm text-gray-700 placeholder:text-gray-400 rounded-xl px-3 py-2 outline-none border border-gray-200" />
          <div>
            <p className="text-xs text-gray-400 mb-1.5 font-medium">Icoon</p>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))} className={cn('text-lg p-1.5 rounded-xl transition-all', form.icon === ic ? 'bg-pink-50 shadow-sm scale-110' : 'hover:bg-gray-100')}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {(['dagelijks', 'wekelijks'] as const).map(f => (
              <button
                key={f}
                onClick={() => setForm(p => ({ ...p, frequency: f }))}
                className={cn('flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all', form.frequency === f ? 'text-white' : 'bg-white text-gray-400 border border-gray-200')}
                style={form.frequency === f ? { background: GRAD } : {}}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 px-3 py-1.5 hover:text-gray-600 transition-colors">Annuleer</button>
            <button onClick={addHabit} className="text-xs text-white px-4 py-1.5 rounded-xl font-semibold shadow-sm" style={{ background: GRAD }}>Opslaan</button>
          </div>
        </div>
      )}

      {/* Week header */}
      <div className="px-6 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1 justify-end mb-1">
          {last7.map(d => (
            <div key={d} className="w-8 text-center">
              <p className="text-[9px] text-gray-400 uppercase font-medium">{format(new Date(d + 'T12:00:00'), 'EEE').slice(0, 2)}</p>
              <p className={cn('text-[10px] font-bold', d === format(new Date(), 'yyyy-MM-dd') ? 'text-gradient' : 'text-gray-300')}>
                {format(new Date(d + 'T12:00:00'), 'd')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : habits.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-gray-400 text-sm font-medium">Nog geen gewoontes. Voeg je eerste toe!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map(habit => (
              <div key={habit.id} className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl hover:shadow-sm transition-all group card-hover">
                <button
                  onClick={() => toggleHabit(habit)}
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-150 flex-shrink-0 shadow-sm',
                    habit.completedToday ? 'scale-95' : 'hover:scale-105'
                  )}
                  style={{ background: habit.completedToday ? GRAD : '#f9fafb', border: '1.5px solid #e2e8f0' }}
                >
                  {habit.completedToday ? (
                    <Check size={16} className="text-white" strokeWidth={2.5} />
                  ) : (
                    <span>{habit.icon}</span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold', habit.completedToday ? 'text-gradient' : 'text-gray-700')}>{habit.name}</p>
                  {habit.streak > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Flame size={10} className="text-orange-400" />
                      <span className="text-[10px] text-orange-400 font-medium">{habit.streak} dag streak</span>
                    </div>
                  )}
                </div>

                {/* Last 7 days */}
                <div className="flex items-center gap-1">
                  {last7.map(d => {
                    const done = habit.logs.some(l => l.logged_date === d)
                    return (
                      <div
                        key={d}
                        className={cn('w-8 h-8 rounded-xl flex items-center justify-center transition-all', done ? '' : 'bg-gray-50 border border-gray-100')}
                        style={done ? { background: GRAD } : {}}
                      >
                        {done && <Check size={10} className="text-white" strokeWidth={3} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
