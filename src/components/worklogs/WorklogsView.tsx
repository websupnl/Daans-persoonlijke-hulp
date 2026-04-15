'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Trash2, Zap, Brain, BarChart3, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkLog {
  id: number
  date: string
  context: string
  category?: string
  type?: string
  project_id?: number
  project_title?: string
  title: string
  description?: string
  duration_minutes: number
  actual_duration_minutes?: number
  expected_duration_minutes?: number
  interruptions?: string
  energy_level?: number
  source?: string
  created_at: string
}

interface WorklogStats {
  context: string
  total_minutes: number
  count: number
}

interface FocusStats {
  total_hours: number
  total_logs: number
  avg_duration_minutes: number
  focus_score: number
  detections: Array<{ type: 'warning' | 'error' | 'info'; message: string }>
}

interface Project { id: number; title: string }

const CONTEXT_OPTIONS = ['Bouma', 'WebsUp', 'privé', 'studie', 'overig']
const GRAD = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)'

const CONTEXT_COLORS: Record<string, string> = {
  Bouma: 'text-blue-600 bg-blue-50',
  WebsUp: 'text-violet-600 bg-violet-50',
  privé: 'text-amber-600 bg-amber-50',
  studie: 'text-emerald-600 bg-emerald-50',
  overig: 'text-gray-500 bg-gray-100',
}

const TYPE_ICONS: Record<string, string> = {
  deep_work: '🎯', meeting: '📅', admin: '📋', physical: '💪', chill: '🛋️',
}

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}u`
  return `${h}u ${m}m`
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function WorklogsView() {
  const [logs, setLogs] = useState<WorkLog[]>([])
  const [stats, setStats] = useState<WorklogStats[]>([])
  const [focusStats, setFocusStats] = useState<FocusStats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', duration_minutes: '', context: 'WebsUp', description: '' })
  const [loading, setLoading] = useState(true)

  // Timer
  const [isRunning, setIsRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerContext, setTimerContext] = useState('WebsUp')
  const [timerTitle, setTimerTitle] = useState('')

  // AI
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  // Restore timer from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('werklog_timer')
      if (saved) {
        const { startTime, context, title } = JSON.parse(saved)
        setTimerStart(new Date(startTime))
        setIsRunning(true)
        setTimerContext(context ?? 'WebsUp')
        setTimerTitle(title ?? '')
      }
    } catch { /* ignore */ }
  }, [])

  // Timer tick
  useEffect(() => {
    if (!isRunning || !timerStart) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, timerStart])

  const load = useCallback(async () => {
    const [logsRes, focusRes, projectsRes] = await Promise.all([
      fetch('/api/worklogs').then(r => r.json()),
      fetch('/api/worklogs/stats?period=week').then(r => r.json()).catch(() => null),
      fetch('/api/projects').then(r => r.json()).catch(() => ({ data: [] })),
    ])
    setLogs(logsRes.logs ?? [])
    setStats(logsRes.stats ?? [])
    setTodayMinutes(logsRes.todayStats?.today_minutes ?? 0)
    setWeekMinutes(logsRes.weekStats?.week_minutes ?? 0)
    setFocusStats(focusRes?.data ?? null)
    setProjects(projectsRes.data ?? projectsRes.projects ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startTimer() {
    const now = new Date()
    setTimerStart(now)
    setIsRunning(true)
    setElapsed(0)
    localStorage.setItem('werklog_timer', JSON.stringify({
      startTime: now.toISOString(),
      context: timerContext,
      title: timerTitle,
    }))
  }

  async function stopTimer() {
    if (!timerStart) return
    const dur = Math.max(1, Math.round((Date.now() - timerStart.getTime()) / 60000))
    await fetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: timerTitle || `${timerContext} sessie`,
        duration_minutes: dur,
        actual_duration_minutes: dur,
        context: timerContext,
        source: 'timer',
      }),
    })
    localStorage.removeItem('werklog_timer')
    setIsRunning(false)
    setTimerStart(null)
    setElapsed(0)
    setTimerTitle('')
    load()
  }

  async function handleAiInput() {
    if (!aiText.trim() || aiLoading) return
    setAiLoading(true)
    setAiStatus(null)
    try {
      const res = await fetch('/api/worklogs/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        setAiStatus(`✓ Opgeslagen: ${formatDuration(data.data.actual_duration_minutes || data.data.duration_minutes)}`)
        setAiText('')
        load()
      } else {
        setAiStatus(`⚠️ ${data.error ?? 'Kon niet verwerken'}`)
      }
    } catch {
      setAiStatus('⚠️ Verbindingsfout')
    } finally {
      setAiLoading(false)
    }
  }

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
    const d = typeof log.date === 'string' ? log.date.split('T')[0] : new Date(log.date).toISOString().split('T')[0]
    if (!acc[d]) acc[d] = []
    acc[d].push(log)
    return acc
  }, {} as Record<string, WorkLog[]>)

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col gap-6 bg-white p-6">
      {/* Header */}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
          <p className="text-gray-400 text-xs mb-1 font-medium">Vandaag</p>
          <p className="text-2xl font-extrabold text-gradient">{formatDuration(todayMinutes)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
          <p className="text-gray-400 text-xs mb-1 font-medium">Deze week</p>
          <p className="text-2xl font-extrabold text-gradient">{formatDuration(weekMinutes)}</p>
        </div>
        {focusStats && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
            <div className="flex items-center gap-1 mb-1">
              <BarChart3 className="w-3 h-3 text-gray-400" />
              <p className="text-gray-400 text-xs font-medium">Focus score</p>
            </div>
            <p className={cn(
              'text-2xl font-extrabold',
              focusStats.focus_score >= 75 ? 'text-emerald-500' :
              focusStats.focus_score >= 50 ? 'text-amber-500' : 'text-red-500'
            )}>
              {focusStats.focus_score}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">/100</p>
          </div>
        )}
        {stats.slice(0, focusStats ? 1 : 2).map(s => (
          <div key={s.context} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm card-hover">
            <p className="text-gray-400 text-xs mb-1 font-medium">{s.context}</p>
            <p className="text-2xl font-extrabold text-gradient">{formatDuration(s.total_minutes)}</p>
            <p className="text-gray-400 text-xs mt-0.5">{s.count} logs</p>
          </div>
        ))}
      </div>

      {/* Detections */}
      {focusStats?.detections && focusStats.detections.length > 0 && (
        <div className="flex flex-col gap-2">
          {focusStats.detections.map((d, i) => (
            <div key={i} className={cn(
              'px-4 py-2.5 rounded-xl border text-sm font-medium',
              d.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
              d.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700' :
              'bg-blue-50 border-blue-100 text-blue-700'
            )}>
              {d.type === 'error' ? '🚨' : d.type === 'warning' ? '⚠️' : 'ℹ️'} {d.message}
            </div>
          ))}
        </div>
      )}

      {/* Timer */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-bold text-gray-700">Timer</span>
          {isRunning && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              actief
            </span>
          )}
        </div>

        {isRunning ? (
          <div className="flex flex-col gap-3 items-center">
            <div className="text-5xl font-mono font-black text-gradient tabular-nums">
              {formatElapsed(elapsed)}
            </div>
            <p className="text-gray-400 text-sm font-medium">{timerContext}{timerTitle ? ` · ${timerTitle}` : ''}</p>
            <button
              onClick={stopTimer}
              className="px-6 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors"
            >
              ⏹ Stop & Opslaan
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              value={timerTitle}
              onChange={e => setTimerTitle(e.target.value)}
              placeholder="Beschrijving (optioneel)"
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
            />
            <div className="flex gap-3">
              <select
                value={timerContext}
                onChange={e => setTimerContext(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
              >
                {CONTEXT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={startTimer}
                className="flex-1 py-2 rounded-xl text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: GRAD }}
              >
                ▶ Start Timer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI quick-add */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-bold text-gray-700">AI toevoegen</span>
        </div>
        <div className="flex gap-2">
          <input
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiInput()}
            placeholder='"2u aan Prime Animals", "Van 19:00 tot 21:30 Sjoeli"...'
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 text-sm focus:outline-none focus:border-pink-300 transition-colors"
          />
          <button
            onClick={handleAiInput}
            disabled={aiLoading || !aiText.trim()}
            className={cn(
              'px-3 py-2 rounded-xl text-sm font-semibold transition-all',
              aiLoading || !aiText.trim()
                ? 'bg-gray-100 text-gray-400'
                : 'text-white shadow-sm hover:opacity-90'
            )}
            style={aiLoading || !aiText.trim() ? undefined : { background: GRAD }}
          >
            {aiLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        {aiStatus && (
          <p className={cn(
            'text-xs mt-2 font-medium',
            aiStatus.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600'
          )}>
            {aiStatus}
          </p>
        )}
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

      {/* Log list grouped by date */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-gray-400 text-center py-10 font-medium">Nog geen werklogs. Gebruik de timer of AI-invoer hierboven!</div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayLogs]) => {
              const total = dayLogs.reduce((sum, l) => sum + (l.actual_duration_minutes || l.duration_minutes || 0), 0)
              return (
                <div key={date}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gradient">{date === todayStr ? 'Vandaag' : date}</h3>
                    <span className="text-gray-400 text-xs font-medium">{formatDuration(total)} totaal</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {dayLogs.map(log => {
                      const actualDur = log.actual_duration_minutes || log.duration_minutes
                      const hasDeviation = log.expected_duration_minutes && actualDur && actualDur > log.expected_duration_minutes
                      return (
                        <div key={log.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start justify-between gap-4 card-hover group">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm text-sm" style={{ background: GRAD }}>
                              {log.type ? (TYPE_ICONS[log.type] ?? <Clock className="w-3.5 h-3.5" />) : <Clock className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-gray-700 text-sm font-semibold truncate">{log.title}</p>
                              {log.description && <p className="text-gray-400 text-xs mt-0.5">{log.description}</p>}
                              {log.project_title && <p className="text-violet-500 text-xs mt-0.5 font-medium">📁 {log.project_title}</p>}
                              {hasDeviation && (
                                <p className="text-amber-600 text-xs mt-0.5">
                                  ⏰ Verwacht {formatDuration(log.expected_duration_minutes)}, werd {formatDuration(actualDur)}
                                </p>
                              )}
                              {log.interruptions && (
                                <p className="text-red-500 text-xs mt-0.5">⚠️ {log.interruptions}</p>
                              )}
                              {log.source === 'ai' && <p className="text-gray-300 text-xs mt-0.5">· AI</p>}
                              {log.source === 'timer' && <p className="text-gray-300 text-xs mt-0.5">· Timer</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', CONTEXT_COLORS[log.context] ?? 'text-gray-500 bg-gray-100')}>
                              {log.context}
                            </span>
                            <span className="text-sm font-extrabold text-gradient">{formatDuration(actualDur)}</span>
                            <button onClick={() => handleDelete(log.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
