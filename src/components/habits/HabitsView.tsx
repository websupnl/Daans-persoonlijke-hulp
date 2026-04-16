'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Flame, Target, Sparkles, Trash2 } from 'lucide-react'
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

const ICONS = ['⭐', '💪', '🏃', '📚', '🧘', '💧', '🥗', '😴', '🎯', '✍️', '🚴', '📵']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', icon: '⭐', color: '#ec4899', frequency: 'dagelijks', description: '' })

  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'))

  const fetchHabits = async () => {
    const res = await fetch('/api/habits')
    const data = await res.json()
    setHabits(data.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchHabits() }, [])

  async function deleteHabit(id: number) {
    await fetch(`/api/habits/${id}`, { method: 'DELETE' })
    fetchHabits()
  }

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
    setForm({ name: '', icon: '⭐', color: '#ec4899', frequency: 'dagelijks', description: '' })
    setShowAdd(false)
    fetchHabits()
  }

  const completedToday = habits.filter((habit) => habit.completedToday).length
  const topStreak = Math.max(...habits.map((habit) => habit.streak), 0)

  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-gradient">Gewoontes</h1>
            <p className="mt-1 text-xs font-medium text-gray-400">{completedToday}/{habits.length} vandaag gedaan · beste streak {topStreak} dagen</p>
          </div>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: GRAD }}
          >
            <Plus size={14} />
            Nieuwe gewoonte
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mx-6 mt-4 rounded-3xl border border-pink-100 bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Naam gewoonte *"
              className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
            />
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Waarom deze belangrijk is"
              className="rounded-2xl border border-white bg-white/90 px-3 py-2.5 text-sm text-gray-700 outline-none"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ICONS.map((icon) => (
              <button
                key={icon}
                onClick={() => setForm((prev) => ({ ...prev, icon }))}
                className={cn('rounded-2xl p-2 text-lg transition-all', form.icon === icon ? 'bg-white shadow-sm scale-110' : 'bg-white/70')}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {(['dagelijks', 'wekelijks'] as const).map((frequency) => (
              <button
                key={frequency}
                onClick={() => setForm((prev) => ({ ...prev, frequency }))}
                className={cn('rounded-2xl px-4 py-2 text-xs font-semibold transition-all', form.frequency === frequency ? 'text-white shadow-sm' : 'bg-white text-gray-500')}
                style={form.frequency === frequency ? { background: GRAD } : undefined}
              >
                {frequency}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-2 text-xs font-medium text-gray-500">Annuleer</button>
            <button onClick={addHabit} className="rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm" style={{ background: GRAD }}>Opslaan</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 px-6 py-4 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Target size={14} className="text-gray-400" />
            <p className="text-sm font-bold text-gray-700">Consistency</p>
          </div>
          <p className="text-2xl font-extrabold text-gradient">{habits.length ? Math.round((completedToday / habits.length) * 100) : 0}%</p>
          <p className="text-xs text-gray-400">van je gewoontes gedaan vandaag</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Flame size={14} className="text-orange-400" />
            <p className="text-sm font-bold text-gray-700">Beste streak</p>
          </div>
          <p className="text-2xl font-extrabold text-gradient">{topStreak}</p>
          <p className="text-xs text-gray-400">dagen achter elkaar</p>
        </div>
        <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-orange-50 via-pink-50 to-violet-50 p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles size={14} className="text-pink-400" />
            <p className="text-sm font-bold text-gray-700">Praktisch advies</p>
          </div>
          <p className="text-sm leading-relaxed text-gray-600">
            {completedToday === habits.length && habits.length > 0
              ? 'Vandaag zit je ritme goed. Houd het klein en herhaalbaar zodat het morgen net zo makkelijk is.'
              : 'Leg je gewoontes zo laagdrempelig mogelijk neer. Het doel is vooral dat je blijft verschijnen.'}
          </p>
        </div>
      </div>

      <div className="px-6 pb-2">
        <div className="mb-2 flex items-center justify-end gap-1">
          {last7.map((day) => (
            <div key={day} className="w-8 text-center">
              <p className="text-[9px] font-medium uppercase text-gray-400">{format(new Date(`${day}T12:00:00`), 'EE').slice(0, 2)}</p>
              <p className={cn('text-[10px] font-bold', day === format(new Date(), 'yyyy-MM-dd') ? 'text-gradient' : 'text-gray-300')}>
                {format(new Date(`${day}T12:00:00`), 'd')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          </div>
        ) : habits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-14 text-center">
            <p className="text-4xl">🎯</p>
            <p className="mt-3 text-sm font-medium text-gray-400">Nog geen gewoontes. Voeg de eerste toe.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <div key={habit.id} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md group">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => toggleHabit(habit)}
                    className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border text-lg shadow-sm transition-all', habit.completedToday ? 'scale-95 border-transparent' : 'border-gray-200 bg-gray-50 hover:scale-105')}
                    style={habit.completedToday ? { background: GRAD } : undefined}
                  >
                    {habit.completedToday ? <Check size={18} className="text-white" strokeWidth={3} /> : habit.icon}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn('text-sm font-bold', habit.completedToday ? 'text-gradient' : 'text-gray-700')}>{habit.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{habit.frequency}</span>
                    </div>
                    {habit.description && <p className="mt-0.5 text-xs text-gray-400">{habit.description}</p>}
                    {habit.streak > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        <Flame size={10} className="text-orange-400" />
                        <span className="text-[10px] font-semibold text-orange-400">{habit.streak} dag streak</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {last7.map((day) => {
                      const done = habit.logs.some((log) => log.logged_date === day)
                      return (
                        <div
                          key={day}
                          className={cn('flex h-8 w-8 items-center justify-center rounded-xl border text-[10px] font-bold', done ? 'border-transparent text-white' : 'border-gray-100 bg-gray-50 text-gray-300')}
                          style={done ? { background: GRAD } : undefined}
                        >
                          {done ? <Check size={10} strokeWidth={3} /> : ''}
                        </div>
                      )
                    })}
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      className="opacity-0 group-hover:opacity-100 ml-1 h-8 w-8 flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
