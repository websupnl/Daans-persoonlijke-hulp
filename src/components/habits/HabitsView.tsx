'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Flame, Target, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, subDays } from 'date-fns'
import PageShell from '@/components/ui/PageShell'
import { Divider, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'

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

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', icon: '⭐', color: '#ec4899', frequency: 'dagelijks', description: '' })

  const last28 = Array.from({ length: 28 }, (_, i) => format(subDays(new Date(), 27 - i), 'yyyy-MM-dd'))

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

  const completedToday = habits.filter((h) => h.completedToday).length
  const topStreak = Math.max(...habits.map((h) => h.streak), 0)
  const consistency = habits.length ? Math.round((completedToday / habits.length) * 100) : 0

  return (
    <PageShell
      title="Gewoontes"
      subtitle={`${completedToday}/${habits.length} vandaag gedaan.`}
      actions={
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#202625] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
        >
          <Plus size={14} />
          Nieuwe gewoonte
        </button>
      }
    >
      <StatStrip stats={[
        { label: 'Consistency', value: `${consistency}%`, meta: 'vandaag' },
        { label: 'Beste streak', value: topStreak, meta: 'dagen', accent: 'amber' },
        { label: 'Gedaan vandaag', value: `${completedToday}/${habits.length}`, meta: 'gewoontes' },
      ]} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          {showAdd && (
            <Panel tone="accent">
              <PanelHeader eyebrow="Nieuw" title="Voeg een gewoonte toe" />
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Naam gewoonte *"
                    className="rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                  />
                  <input
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Waarom is dit belangrijk?"
                    className="rounded-lg border border-black/5 bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                  />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Icoon</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ICONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setForm((p) => ({ ...p, icon }))}
                        className={cn('rounded-lg p-2 text-base transition-colors', form.icon === icon ? 'bg-[#202625]' : 'bg-white hover:bg-surface-container-low')}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['dagelijks', 'wekelijks'] as const).map((frequency) => (
                    <button
                      key={frequency}
                      onClick={() => setForm((p) => ({ ...p, frequency }))}
                      className={cn(
                        'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
                        form.frequency === frequency ? 'bg-[#202625] text-white' : 'border border-black/5 bg-white text-on-surface-variant hover:bg-surface-container-low'
                      )}
                    >
                      {frequency}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={addHabit} className="rounded-lg bg-[#202625] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]">
                  Opslaan
                </button>
                <button onClick={() => setShowAdd(false)} className="rounded-lg border border-black/5 bg-white px-3.5 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low">
                  Annuleer
                </button>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader
              eyebrow="Tracking"
              title="Jouw gewoontes"
            />

            <div className="mt-4 space-y-0">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-container-low my-1" />
                ))
              ) : habits.length === 0 ? (
                <EmptyPanel
                  title="Nog geen gewoontes"
                  description="Voeg je eerste gewoonte toe. Houd het klein en concreet."
                />
              ) : (
                habits.map((habit, index) => (
                  <div key={habit.id}>
                    {index > 0 && <Divider />}
                    <div className="group flex flex-wrap items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-surface-container-low/50">
                      <button
                        onClick={() => toggleHabit(habit)}
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                          habit.completedToday
                            ? 'border-transparent bg-[#202625]'
                            : 'border-black/8 bg-surface-container-low hover:bg-surface-container'
                        )}
                      >
                        {habit.completedToday
                          ? <Check size={16} className="text-white" strokeWidth={2.5} />
                          : <span className="text-base">{habit.icon}</span>}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className={cn('text-sm font-semibold text-on-surface', habit.completedToday && 'line-through text-on-surface-variant')}>{habit.name}</p>
                          <span className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">{habit.frequency}</span>
                          {habit.completedToday && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">✓ Gedaan</span>}
                        </div>
                        {habit.streak > 0 && (
                          <div className="mt-0.5 flex items-center gap-1">
                            <Flame size={9} className="text-orange-500" />
                            <span className="text-[10px] font-semibold text-orange-500">{habit.streak} dag streak</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="hidden grid-cols-7 gap-0.5 sm:grid">
                          {last28.map((day) => {
                            const done = habit.logs.some((log) => log.logged_date === day)
                            return (
                              <div
                                key={day}
                                title={format(new Date(`${day}T12:00:00`), 'd MMM')}
                                className={cn('h-2.5 w-2.5 rounded-sm', done ? 'bg-[#202625]' : 'bg-surface-container')}
                              />
                            )
                          })}
                        </div>
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-on-surface-variant opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <Panel tone="muted">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Vandaag</p>
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Voortgang</span>
                <span className="font-semibold">{consistency}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                <div className="h-full rounded-full bg-[#202625] transition-all duration-500" style={{ width: `${consistency}%` }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-md border border-black/5 bg-white px-2 py-1 text-[11px] font-medium text-on-surface-variant">{completedToday} gedaan</span>
              <span className="rounded-md border border-black/5 bg-white px-2 py-1 text-[11px] font-medium text-on-surface-variant">{habits.length - completedToday} resterend</span>
            </div>
          </Panel>

          <Panel>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant/60">Tip</p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              {completedToday === habits.length && habits.length > 0
                ? 'Vandaag zit je ritme goed. Houd het klein en herhaalbaar zodat het morgen net zo makkelijk is.'
                : 'Leg je gewoontes zo laagdrempelig mogelijk neer. Het doel is dat je blijft verschijnen.'}
            </p>
          </Panel>
        </div>
      </div>
    </PageShell>
  )
}
