'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timer, Plus, Send, Trash2, ChevronLeft, ChevronRight, BarChart3, Zap, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, parseISO, subDays, addDays } from 'date-fns'
import { nl } from 'date-fns/locale'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorklogEntry {
  id: string
  title: string | null
  category: string
  type: string
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  actual_duration_minutes: number | null
  expected_duration_minutes: number | null
  interruptions: string | null
  context_notes: string | null
  project_title: string | null
  project_color: string | null
  source: string
}

interface DayStat {
  day: string
  hours: number
  log_count: number
}

interface CategoryBreakdown {
  category: string
  hours: number
  count: number
}

interface WorklogStats {
  total_hours: number
  total_logs: number
  avg_duration_minutes: number
  focus_score: number
  category_breakdown: CategoryBreakdown[]
  days: DayStat[]
  detections: Array<{ type: 'warning' | 'error' | 'info'; message: string }>
}

interface Project {
  id: number
  title: string
  color: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, string> = {
  business: 'bg-brand-950/40 text-brand-300 border-brand-800/30',
  work: 'bg-blue-950/40 text-blue-300 border-blue-800/30',
  private: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/30',
}

const CATEGORY_DOT: Record<string, string> = {
  business: 'bg-brand-500',
  work: 'bg-blue-500',
  private: 'bg-emerald-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  business: 'Business',
  work: 'Werk',
  private: 'Privé',
}

const TYPE_ICONS: Record<string, string> = {
  deep_work: '🎯',
  meeting: '📅',
  admin: '📋',
  physical: '💪',
  chill: '🛋️',
}

const TYPE_LABELS: Record<string, string> = {
  deep_work: 'Deep Work',
  meeting: 'Meeting',
  admin: 'Administratie',
  physical: 'Fysiek',
  chill: 'Ontspanning',
}

const EMPTY_FORM = {
  title: '',
  project_id: '',
  type: 'deep_work',
  category: 'business',
  actual_duration_minutes: '',
  expected_duration_minutes: '',
  context_notes: '',
  interruptions: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—'
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

function inferCategory(projectId: string, projects: Project[]): string {
  if (!projectId) return 'business'
  const p = projects.find(x => String(x.id) === projectId)
  if (p?.title?.toLowerCase().includes('bouma')) return 'work'
  return 'business'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorklogView() {
  const [logs, setLogs] = useState<WorklogEntry[]>([])
  const [stats, setStats] = useState<WorklogStats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week')

  // Timer
  const [isRunning, setIsRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerProjectId, setTimerProjectId] = useState('')
  const [timerType, setTimerType] = useState('deep_work')
  const [timerTitle, setTimerTitle] = useState('')

  // Forms
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  // Restore timer from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('worklog_timer')
      if (saved) {
        const { startTime, projectId, type, title } = JSON.parse(saved)
        setTimerStart(new Date(startTime))
        setIsRunning(true)
        setTimerProjectId(projectId || '')
        setTimerType(type || 'deep_work')
        setTimerTitle(title || '')
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [logsRes, statsRes, projectsRes] = await Promise.all([
      fetch(`/api/worklogs?date=${selectedDate}`).then(r => r.json()),
      fetch(`/api/worklogs/stats?period=${period}`).then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ])
    setLogs(logsRes.data || [])
    setStats(statsRes.data || null)
    setProjects(projectsRes.data || [])
    setLoading(false)
  }, [selectedDate, period])

  useEffect(() => { fetchData() }, [fetchData])

  function startTimer() {
    const now = new Date()
    setTimerStart(now)
    setIsRunning(true)
    setElapsed(0)
    localStorage.setItem('worklog_timer', JSON.stringify({
      startTime: now.toISOString(),
      projectId: timerProjectId,
      type: timerType,
      title: timerTitle,
    }))
  }

  async function stopTimer() {
    if (!timerStart) return
    const now = new Date()
    const dur = Math.max(1, Math.round((now.getTime() - timerStart.getTime()) / 60000))

    await fetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: timerTitle || null,
        project_id: timerProjectId || null,
        type: timerType,
        category: inferCategory(timerProjectId, projects),
        start_time: timerStart.toISOString(),
        end_time: now.toISOString(),
        duration_minutes: dur,
        actual_duration_minutes: dur,
        source: 'timer',
      }),
    })

    localStorage.removeItem('worklog_timer')
    setIsRunning(false)
    setTimerStart(null)
    setElapsed(0)
    setTimerTitle('')
    fetchData()
  }

  async function saveQuickAdd() {
    const dur = parseInt(form.actual_duration_minutes || '0')
    if (!dur) return

    await fetch('/api/worklogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title || null,
        project_id: form.project_id || null,
        type: form.type,
        category: form.category,
        actual_duration_minutes: dur,
        duration_minutes: dur,
        expected_duration_minutes: form.expected_duration_minutes ? parseInt(form.expected_duration_minutes) : null,
        context_notes: form.context_notes || null,
        interruptions: form.interruptions || null,
        source: 'manual',
      }),
    })

    setForm({ ...EMPTY_FORM })
    setShowQuickAdd(false)
    fetchData()
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
        const d = data.data
        const dur = d.actual_duration_minutes || d.duration_minutes
        setAiStatus(`✓ Opgeslagen: ${d.project_title ? `${d.project_title} · ` : ''}${formatDuration(dur)}`)
        setAiText('')
        fetchData()
      } else {
        setAiStatus(`⚠️ ${data.error || 'Kon niet verwerken'}`)
      }
    } catch {
      setAiStatus('⚠️ Verbindingsfout')
    } finally {
      setAiLoading(false)
    }
  }

  async function deleteLog(id: string) {
    await fetch(`/api/worklogs?id=${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  const todayHours = logs.reduce((sum, l) => {
    return sum + (Number(l.actual_duration_minutes || l.duration_minutes || 0)) / 60
  }, 0)

  const maxDayHours = Math.max(...(stats?.days.map(d => Number(d.hours)) || [0]), 1)
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Timer size={16} className="text-brand-400" />
          <div>
            <h1 className="text-sm font-semibold text-white">Worklog</h1>
            <p className="text-[11px] text-slate-500">Tijdregistratie & analyse</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(['today', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-lg transition-colors',
                period === p
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'bg-white/5 text-slate-500 hover:text-slate-300'
              )}
            >
              {p === 'today' ? 'Vandaag' : p === 'week' ? 'Week' : 'Maand'}
            </button>
          ))}
          <button
            onClick={() => setShowQuickAdd(s => !s)}
            className="w-7 h-7 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center hover:bg-brand-600/30 transition-colors ml-1"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#13151c] border border-white/5 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 mb-1">Uren gelogd</p>
              <p className="text-lg font-bold text-white">{stats.total_hours}u</p>
              <p className="text-[10px] text-slate-600">{stats.total_logs} sessies</p>
            </div>
            <div className="bg-[#13151c] border border-white/5 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 mb-1">Focus score</p>
              <p className={cn(
                'text-lg font-bold',
                stats.focus_score >= 75 ? 'text-emerald-400' :
                stats.focus_score >= 50 ? 'text-amber-400' : 'text-red-400'
              )}>
                {stats.focus_score}
              </p>
              <p className="text-[10px] text-slate-600">/100</p>
            </div>
            <div className="bg-[#13151c] border border-white/5 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 mb-1">Gem. sessie</p>
              <p className="text-lg font-bold text-white">{formatDuration(stats.avg_duration_minutes)}</p>
              <p className="text-[10px] text-slate-600">per blok</p>
            </div>
          </div>
        )}

        {/* Detections */}
        {stats?.detections && stats.detections.length > 0 && (
          <div className="space-y-1.5">
            {stats.detections.map((d, i) => (
              <div key={i} className={cn(
                'px-3 py-2 rounded-lg border text-xs',
                d.type === 'error' ? 'bg-red-950/30 border-red-800/40 text-red-300' :
                d.type === 'warning' ? 'bg-amber-950/30 border-amber-800/40 text-amber-300' :
                'bg-brand-950/20 border-brand-800/40 text-brand-300'
              )}>
                {d.type === 'error' ? '🚨' : d.type === 'warning' ? '⚠️' : 'ℹ️'} {d.message}
              </div>
            ))}
          </div>
        )}

        {/* Timer */}
        <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-brand-400" />
            <span className="text-xs font-medium text-slate-300">Timer</span>
            {isRunning && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-brand-400">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse" />
                actief
              </span>
            )}
          </div>

          {isRunning ? (
            <div className="space-y-3">
              <div className="text-center py-2">
                <div className="text-4xl font-mono font-bold text-brand-400 tabular-nums">
                  {formatElapsed(elapsed)}
                </div>
                {(timerProjectId || timerTitle) && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {projects.find(p => String(p.id) === timerProjectId)?.title || ''}
                    {timerTitle ? ` · ${timerTitle}` : ''}
                    {' · '}{TYPE_ICONS[timerType]} {TYPE_LABELS[timerType]}
                  </p>
                )}
              </div>
              <button
                onClick={stopTimer}
                className="w-full py-2 rounded-lg bg-red-900/30 text-red-300 border border-red-800/40 text-sm font-medium hover:bg-red-900/50 transition-colors"
              >
                ⏹ Stop & Opslaan
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={timerTitle}
                onChange={e => setTimerTitle(e.target.value)}
                placeholder="Beschrijving (optioneel)"
                className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded-lg px-3 py-1.5 text-xs outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={timerProjectId}
                  onChange={e => setTimerProjectId(e.target.value)}
                  className="bg-white/5 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="">Project (opt.)</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.title}</option>
                  ))}
                </select>
                <select
                  value={timerType}
                  onChange={e => setTimerType(e.target.value)}
                  className="bg-white/5 text-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                >
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{TYPE_ICONS[val]} {label}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={startTimer}
                className="w-full py-2 rounded-lg bg-brand-600/20 text-brand-300 border border-brand-800/40 text-sm font-medium hover:bg-brand-600/30 transition-colors"
              >
                ▶ Start Timer
              </button>
            </div>
          )}
        </div>

        {/* AI input */}
        <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={12} className="text-brand-400" />
            <span className="text-xs font-medium text-slate-300">AI toevoegen</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiInput()}
              placeholder='"2u aan Prime Animals", "Van 19:00 tot 21:30 Sjoeli"...'
              className="flex-1 bg-white/5 text-slate-300 placeholder:text-slate-600 rounded-lg px-3 py-1.5 text-xs outline-none"
            />
            <button
              onClick={handleAiInput}
              disabled={aiLoading || !aiText.trim()}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs transition-colors',
                aiLoading || !aiText.trim()
                  ? 'bg-white/5 text-slate-600'
                  : 'bg-brand-600/20 text-brand-300 hover:bg-brand-600/30'
              )}
            >
              {aiLoading ? (
                <div className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={12} />
              )}
            </button>
          </div>
          {aiStatus && (
            <p className={cn(
              'text-[10px] mt-1.5',
              aiStatus.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'
            )}>
              {aiStatus}
            </p>
          )}
        </div>

        {/* Quick add form */}
        {showQuickAdd && (
          <div className="bg-[#13151c] border border-white/10 rounded-xl p-4 animate-fade-in">
            <p className="text-xs font-medium text-slate-300 mb-3">Handmatig toevoegen</p>
            <div className="space-y-2">
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Omschrijving (optioneel)"
                className="w-full bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 text-xs outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className="bg-white/5 text-slate-300 rounded px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="">Geen project</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.title}</option>
                  ))}
                </select>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="bg-white/5 text-slate-300 rounded px-2.5 py-1.5 text-xs outline-none"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="bg-white/5 text-slate-300 rounded px-2.5 py-1.5 text-xs outline-none"
                >
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{TYPE_ICONS[val]} {label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={form.actual_duration_minutes}
                  onChange={e => setForm(f => ({ ...f, actual_duration_minutes: e.target.value }))}
                  placeholder="Minuten *"
                  min={1}
                  className="bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 text-xs outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={form.expected_duration_minutes}
                  onChange={e => setForm(f => ({ ...f, expected_duration_minutes: e.target.value }))}
                  placeholder="Verwacht (min)"
                  min={1}
                  className="bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 text-xs outline-none"
                />
                <input
                  value={form.interruptions}
                  onChange={e => setForm(f => ({ ...f, interruptions: e.target.value }))}
                  placeholder="Onderbrekingen"
                  className="bg-white/5 text-slate-300 placeholder:text-slate-600 rounded px-2.5 py-1.5 text-xs outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowQuickAdd(false)}
                  className="flex-1 py-1.5 rounded bg-white/5 text-slate-500 text-xs"
                >
                  Annuleer
                </button>
                <button
                  onClick={saveQuickAdd}
                  disabled={!form.actual_duration_minutes}
                  className="flex-1 py-1.5 rounded bg-brand-600 text-white text-xs disabled:opacity-40"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Day log */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ChevronLeft size={12} />
              </button>
              <span className={cn('text-xs font-medium capitalize', isToday ? 'text-brand-300' : 'text-slate-300')}>
                {isToday ? 'Vandaag' : format(parseISO(selectedDate), 'EEEE d MMM', { locale: nl })}
              </span>
              <button
                onClick={() => setSelectedDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd'))}
                className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ChevronRight size={12} />
              </button>
              {!isToday && (
                <button
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className="text-[10px] text-slate-600 hover:text-slate-400 ml-1"
                >
                  vandaag
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-500">
              {todayHours.toFixed(1)}u · {logs.length} sessies
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-xs">
              Geen logs voor {isToday ? 'vandaag' : 'deze dag'} — start de timer of voeg handmatig toe
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map(log => {
                const dur = log.actual_duration_minutes || log.duration_minutes
                const hasDeviation = log.expected_duration_minutes && dur && dur > log.expected_duration_minutes
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 rounded-xl border text-xs group',
                      CATEGORY_STYLES[log.category] || CATEGORY_STYLES.business
                    )}
                  >
                    <div className="text-sm leading-none mt-0.5 flex-shrink-0">
                      {TYPE_ICONS[log.type] || '⏱️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {log.start_time && (
                          <span className="opacity-50 text-[10px] font-mono">
                            {format(new Date(log.start_time), 'HH:mm')}
                          </span>
                        )}
                        {log.project_title && (
                          <span className="font-medium">{log.project_title}</span>
                        )}
                        {log.title && (
                          <span className={cn(log.project_title ? 'opacity-60 truncate' : 'font-medium truncate')}>
                            {log.project_title ? `· ${log.title}` : log.title}
                          </span>
                        )}
                        <span className="ml-auto font-mono text-[10px] opacity-70 flex-shrink-0">
                          {formatDuration(dur)}
                        </span>
                      </div>
                      {hasDeviation && (
                        <p className="text-[10px] opacity-60 mt-0.5">
                          ⏰ Verwacht {formatDuration(log.expected_duration_minutes)}, werd {formatDuration(dur)}
                        </p>
                      )}
                      {log.interruptions && (
                        <p className="text-[10px] opacity-60 mt-0.5">⚠️ {log.interruptions}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] opacity-40">{TYPE_LABELS[log.type]}</span>
                        {log.source !== 'manual' && (
                          <span className="text-[10px] opacity-40">· {log.source}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Week chart */}
        {stats && stats.days.length > 0 && (
          <div className="bg-[#13151c] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={12} className="text-brand-400" />
              <span className="text-xs font-medium text-slate-300">
                {period === 'month' ? '30 dagen' : '7 dagen'}
              </span>
            </div>
            <div className="space-y-1.5">
              {stats.days.slice(0, 10).map(d => {
                const pct = Math.round((Number(d.hours) / maxDayHours) * 100)
                const dayIsToday = d.day === format(new Date(), 'yyyy-MM-dd')
                return (
                  <div key={d.day} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'w-8 text-[10px] text-right shrink-0 capitalize',
                        dayIsToday ? 'text-brand-400 font-medium' : 'text-slate-600'
                      )}
                    >
                      {format(parseISO(d.day), 'EEE', { locale: nl })}
                    </span>
                    <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          dayIsToday ? 'bg-brand-500' : 'bg-slate-600'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-9 text-[10px] text-slate-500 text-right shrink-0">
                      {d.hours}u
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Category breakdown */}
            {stats.category_breakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
                {stats.category_breakdown.map(c => (
                  <div key={c.category} className="flex items-center gap-1.5">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', CATEGORY_DOT[c.category] || 'bg-slate-500')} />
                    <span className="text-[10px] text-slate-500">
                      {CATEGORY_LABELS[c.category] || c.category}: {c.hours}u
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
