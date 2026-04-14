'use client'

import { useState, useEffect } from 'react'
import { Clock, Plus, Trash2 } from 'lucide-react'

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

const CONTEXT_COLORS: Record<string, string> = {
  Bouma: 'text-blue-400 bg-blue-500/10',
  WebsUp: 'text-violet-400 bg-violet-500/10',
  privé: 'text-amber-400 bg-amber-500/10',
  studie: 'text-emerald-400 bg-emerald-500/10',
  overig: 'text-gray-400 bg-gray-500/10',
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

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Werklog</h1>
          <p className="text-gray-400 text-sm mt-1">Tijdregistratie en werkactiviteit</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Log toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Vandaag</p>
          <p className="text-white text-xl font-bold">{formatDuration(todayMinutes)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-gray-400 text-xs mb-1">Deze week</p>
          <p className="text-white text-xl font-bold">{formatDuration(weekMinutes)}</p>
        </div>
        {stats.slice(0, 2).map(s => (
          <div key={s.context} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">{s.context}</p>
            <p className="text-white text-xl font-bold">{formatDuration(s.total_minutes)}</p>
            <p className="text-gray-500 text-xs">{s.count} logs</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex flex-col gap-4">
          <h2 className="text-white font-semibold">Werklog toevoegen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Omschrijving *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Wat heb je gedaan?" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Duur (minuten) *</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} required placeholder="120" min="1" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Context *</label>
              <select value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                {CONTEXT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-400 text-xs">Notitie</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optioneel" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">Opslaan</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">Annuleren</button>
          </div>
        </form>
      )}

      {/* Logs grouped by date */}
      {loading ? (
        <div className="text-gray-500 text-center py-10">Laden...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-gray-500 text-center py-10">Nog geen werklogs. Voeg je eerste log toe!</div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, dayLogs]) => {
            const total = dayLogs.reduce((sum, l) => sum + l.duration_minutes, 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-gray-300 text-sm font-medium">{date === today ? 'Vandaag' : date}</h3>
                  <span className="text-gray-500 text-xs">{formatDuration(total)} totaal</span>
                </div>
                <div className="flex flex-col gap-2">
                  {dayLogs.map(log => (
                    <div key={log.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Clock className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{log.title}</p>
                          {log.description && <p className="text-gray-400 text-xs mt-0.5">{log.description}</p>}
                          {log.project_title && <p className="text-violet-400 text-xs mt-0.5">📁 {log.project_title}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${CONTEXT_COLORS[log.context] ?? 'text-gray-400 bg-gray-500/10'}`}>{log.context}</span>
                        <span className="text-white text-sm font-bold">{formatDuration(log.duration_minutes)}</span>
                        <button onClick={() => handleDelete(log.id)} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
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
