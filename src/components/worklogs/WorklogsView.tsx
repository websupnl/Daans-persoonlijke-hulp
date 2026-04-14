'use client'

import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkLog {
  id: number
  date: string
  context: string
  project_id?: number
  project_title?: string
  title: string
  description?: string
  duration_minutes: number
  energy_level?: number
  created_at: string
}

interface WorklogStats {
  context: string
  total_minutes: number
  count: number
}

const CONTEXT_OPTIONS = ['Bouma', 'WebsUp', 'privé', 'studie', 'overig']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

const CONTEXT_COLORS: Record<string, string> = {
  Bouma: 'text-blue-600 bg-blue-50',
  WebsUp: 'text-violet-600 bg-violet-50',
  privé: 'text-amber-600 bg-amber-50',
  studie: 'text-emerald-600 bg-emerald-50',
  overig: 'text-gray-500 bg-gray-100',
}

function formatDuration(minutes: number): string {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}u`
  return `${h}u ${m}m`
}

export default function WorklogsView() {
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [stats, setStats] = useState<WorklogStats[]>([])
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', duration_minutes: '', context: 'WebsUp', description: '' })
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/worklogs')
    const data = await res.json()
    setLogs(data.logs ?? [])
    setStats(data.stats ?? [])
    setTodayMinutes(data.todayStats?.today_minutes ?? 0)
    setWeekMinutes(data.weekStats?.week_minutes ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, duration_minutes: parseInt(form.duration_minutes) }),
    })
    setForm({ title: '', duration_minutes: '', context: 'WebsUp', description: '' })
    setShowForm(false)
    load()
  }

  async function handleDelete(id: number) {
    await fetch(`/api/worklogs/${id}`, { method: 'DELETE' })
    load()
  }

  const grouped = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = []
    acc[log.date].push(log)
    return acc
  }, {} as Record<string, WorkLog[]>)

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto bg-white min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gradient">Werklog</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">Tijdregistratie en werkactiviteit</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90"
          style={{ background: GRAD }}
        >
          <Plus className="w-4 h-4" />
          Log toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
          <p className="text-gray-400 text-xs mb-1 font-medium">Vandaag</p>
          <p className="text-2xl font-extrabold text-gradient">{formatDuration(todayMinutes)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
          <p className="text-gray-400 text-xs mb-1 font-medium">Deze week</p>
          <p className="text-2xl font-extrabold text-gradient">{formatDuration(weekMinutes)}</p>
        </div>
        {stats.slice(0, 2).map(s => (
          <div key={s.context} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
            <p className="text-gray-400 text-xs mb-1 font-medium">{s.context}</p>
            <p className="text-2xl font-extrabold text-gradient">{formatDuration(s.total_minutes)}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.count} logs</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gradient">Werklog toevoegen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-medium">Omschrijving *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Wat heb je gedaan?" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-medium">Duur (minuten) *</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} required placeholder="120" min="1" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-medium">Context *</label>
              <select value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors">
                {CONTEXT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs font-medium">Notitie</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optioneel" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-sm transition-opacity hover:opacity-90" style={{ background: GRAD }}>Opslaan</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-xl text-sm transition-colors font-medium">Annuleren</button>
          </div>
        </form>
      )}

      {/* Logs grouped by date */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-gray-400 text-center py-10 font-medium">Nog geen werklogs. Voeg je eerste log toe!</div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, dayLogs]) => {
            const total = dayLogs.reduce((sum, l) => sum + l.duration_minutes, 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gradient">{date === todayStr ? 'Vandaag' : date}</h3>
                  <span className="text-gray-400 text-xs font-medium">{formatDuration(total)} totaal</span>
                </div>
                <div className="flex flex-col gap-2">
                  {dayLogs.map(log => (
                    <div key={log.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start justify-between gap-4 card-hover group">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm" style={{ background: GRAD }}>
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-gray-700 text-sm font-semibold truncate">{log.title}</p>
                          {log.description && <p className="text-gray-400 text-xs mt-0.5">{log.description}</p>}
                          {log.project_title && <p className="text-violet-500 text-xs mt-0.5 font-medium">📁 {log.project_title}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', CONTEXT_COLORS[log.context] ?? 'text-gray-500 bg-gray-100')}>{log.context}</span>
                        <span className="text-sm font-extrabold text-gradient">{formatDuration(log.duration_minutes)}</span>
                        <button onClick={() => handleDelete(log.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
