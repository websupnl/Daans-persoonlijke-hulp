'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Trash2, Zap, Brain, BarChart3, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatAction } from '@/lib/chat/types'
import AIContextButton from '@/components/ai/AIContextButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/interfaces-select'
import PageShell from '@/components/ui/PageShell'
import { ActionPill, EmptyPanel, Panel, PanelHeader, StatStrip } from '@/components/ui/Panel'

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

const CONTEXT_PILLS: Record<string, string> = {
  Bouma: 'bg-blue-50 text-blue-700',
  WebsUp: 'bg-violet-50 text-violet-700',
  privé: 'bg-amber-50 text-amber-700',
  studie: 'bg-emerald-50 text-emerald-700',
  overig: 'bg-surface-container text-on-surface-variant',
}

const CONTEXT_BAR: Record<string, string> = {
  Bouma: 'bg-blue-400',
  WebsUp: 'bg-violet-400',
  privé: 'bg-amber-400',
  studie: 'bg-emerald-400',
  overig: 'bg-surface-container-high',
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
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)

  const [isRunning, setIsRunning] = useState(false)
  const [timerStart, setTimerStart] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [timerContext, setTimerContext] = useState('WebsUp')
  const [timerTitle, setTimerTitle] = useState('')

  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [aiProposal, setAiProposal] = useState<{ reply: string; actions: ChatAction[] } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('werklog_timer')
      if (saved) {
        const { startTime, context, title } = JSON.parse(saved) as { startTime: string; context: string; title: string }
        setTimerStart(new Date(startTime))
        setIsRunning(true)
        setTimerContext(context ?? 'WebsUp')
        setTimerTitle(title ?? '')
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!isRunning || !timerStart) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, timerStart])

  const load = useCallback(async () => {
    const [logsRes, focusRes, projectsRes] = await Promise.all([
      fetch('/api/worklogs').then((r) => r.json()),
      fetch('/api/worklogs/stats?period=week').then((r) => r.json()).catch(() => null),
      fetch('/api/projects').then((r) => r.json()).catch(() => ({ data: [] })),
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

  useEffect(() => {
    if (loading) return
    setAiSummaryLoading(true)
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'worklogs' }),
    })
      .then((r) => r.json())
      .then((d) => setAiSummary(d.summary ?? null))
      .catch(() => {})
      .finally(() => setAiSummaryLoading(false))
  }, [loading])

  void projects

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

  async function handleAiInputEnhanced() {
    if (!aiText.trim() || aiLoading) return
    setAiLoading(true)
    setAiStatus(null)
    setAiProposal(null)
    try {
      const res = await fetch('/api/worklogs/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      })
      const data = await res.json()
      if (res.status === 201 && data.mode === 'created') {
        setAiStatus(data.reply ?? 'Opgeslagen.')
        setAiText('')
        load()
      } else if (res.status === 202 && data.actions?.length) {
        setAiProposal({ reply: data.reply, actions: data.actions })
      } else {
        setAiStatus(data.reply ?? data.error ?? 'Kon niet verwerken')
      }
    } catch {
      setAiStatus('Verbindingsfout')
    } finally {
      setAiLoading(false)
    }
  }

  async function confirmAiProposal() {
    if (!aiProposal || aiLoading) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/worklogs/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true, actions: aiProposal.actions }),
      })
      const data = await res.json()
      if (res.ok) {
        setAiStatus(data.reply ?? 'Opgeslagen.')
        setAiProposal(null)
        setAiText('')
        load()
      } else {
        setAiStatus(data.error ?? 'Kon voorstel niet uitvoeren')
      }
    } catch {
      setAiStatus('Verbindingsfout')
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
  const maxStatMinutes = stats.reduce((m, s) => Math.max(m, s.total_minutes), 1)

  return (
    <PageShell
      title="Werklog"
      subtitle="Tijdregistratie en werkactiviteit. Zie precies waar je tijd naartoe gaat."
      actions={
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
        >
          <Plus size={15} />
          Log toevoegen
        </button>
      }
    >
      <StatStrip stats={[
        { label: 'Vandaag', value: formatDuration(todayMinutes), meta: 'gelogd' },
        { label: 'Deze week', value: formatDuration(weekMinutes), meta: 'totaal' },
        ...(focusStats ? [{ label: 'Focus score', value: focusStats.focus_score, meta: '/100' }] : []),
        ...(stats[0] ? [{ label: stats[0].context, value: formatDuration(stats[0].total_minutes), meta: `${stats[0].count} logs` }] : []),
      ]} />

      {(aiSummary || aiSummaryLoading) && (
        <Panel tone="accent">
          <div className="flex items-start gap-2.5">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-on-surface-variant" />
            {aiSummaryLoading ? (
              <div className="flex gap-1 mt-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-surface-variant/40" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            ) : (
              <p className="text-sm leading-7 text-on-surface-variant">{aiSummary}</p>
            )}
          </div>
        </Panel>
      )}

      {focusStats?.detections && focusStats.detections.length > 0 && (
        <div className="flex flex-col gap-2">
          {focusStats.detections.map((d, i) => (
            <div
              key={i}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-medium',
                d.type === 'error' ? 'border-red-100 bg-red-50 text-red-700' :
                d.type === 'warning' ? 'border-amber-100 bg-amber-50 text-amber-700' :
                'border-blue-100 bg-blue-50 text-blue-700'
              )}
            >
              {d.type === 'error' ? '🚨' : d.type === 'warning' ? '⚠️' : 'ℹ️'} {d.message}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {showForm && (
            <Panel tone="accent">
              <PanelHeader eyebrow="Handmatig toevoegen" title="Werklog toevoegen" />
              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    required
                    placeholder="Wat heb je gedaan? *"
                    className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    style={{ fontSize: '16px' }}
                  />
                  <input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                    required
                    placeholder="Duur in minuten *"
                    min="1"
                    className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    style={{ fontSize: '16px' }}
                  />
                  <Select value={form.context} onValueChange={(value) => setForm((f) => ({ ...f, context: value }))}>
                    <SelectTrigger className="w-full rounded-lg px-3.5 py-2.5 text-sm" style={{ fontSize: '16px' }}>
                      <SelectValue placeholder="Context" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTEXT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Notitie (optioneel)"
                    className="rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                    style={{ fontSize: '16px' }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]">
                    Opslaan
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-low">
                    Annuleren
                  </button>
                </div>
              </form>
            </Panel>
          )}

          {loading ? (
            <Panel>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container-low" />
                ))}
              </div>
            </Panel>
          ) : Object.keys(grouped).length === 0 ? (
            <Panel>
              <EmptyPanel
                title="Nog geen werklogs"
                description="Gebruik de timer of AI-invoer rechts om een werklog toe te voegen."
              />
            </Panel>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dayLogs]) => {
                  const total = dayLogs.reduce((sum, l) => sum + (l.actual_duration_minutes || l.duration_minutes || 0), 0)
                  return (
                    <Panel key={date}>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-extrabold text-on-surface">
                          {date === todayStr ? 'Vandaag' : date}
                        </p>
                        <ActionPill>{formatDuration(total)} totaal</ActionPill>
                      </div>
                      <div className="space-y-2">
                        {dayLogs.map((log) => {
                          const actualDur = log.actual_duration_minutes || log.duration_minutes
                          const hasDeviation = log.expected_duration_minutes && actualDur && actualDur > log.expected_duration_minutes
                          return (
                            <div key={log.id} className="group flex items-start justify-between gap-4 rounded-xl border border-outline-variant bg-white p-4">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low text-sm">
                                  {log.type ? (TYPE_ICONS[log.type] ?? <Clock size={14} className="text-on-surface-variant" />) : <Clock size={14} className="text-on-surface-variant" />}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-on-surface">{log.title}</p>
                                  {log.description && <p className="mt-0.5 text-xs text-on-surface-variant">{log.description}</p>}
                                  {log.project_title && <p className="mt-0.5 text-xs text-on-surface-variant">📁 {log.project_title}</p>}
                                  {hasDeviation && (
                                    <p className="mt-0.5 text-xs text-amber-600">
                                      ⏰ Verwacht {formatDuration(log.expected_duration_minutes)}, werd {formatDuration(actualDur)}
                                    </p>
                                  )}
                                  {log.interruptions && <p className="mt-0.5 text-xs text-red-500">⚠️ {log.interruptions}</p>}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', CONTEXT_PILLS[log.context] ?? 'bg-surface-container text-on-surface-variant')}>
                                  {log.context}
                                </span>
                                <span className="text-sm font-extrabold text-on-surface">{formatDuration(actualDur)}</span>
                                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                  <AIContextButton type="worklog" title={log.title} content={log.description} id={log.id} />
                                  <button
                                    onClick={() => handleDelete(log.id)}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-[#a55a2c]"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Panel>
                  )
                })}
            </div>
          )}
        </div>

        <div className="space-y-5 xl:sticky xl:top-8 xl:self-start">
          <Panel tone={isRunning ? 'accent' : 'default'}>
            <PanelHeader
              eyebrow="Timer"
              title={isRunning ? 'Timer loopt' : 'Start timer'}
              description={isRunning ? undefined : 'Meet je werktijd precies.'}
            />

            {isRunning ? (
              <div className="mt-4 flex flex-col items-center gap-3">
                <div className="font-mono text-5xl font-black tabular-nums text-on-surface">
                  {formatElapsed(elapsed)}
                </div>
                <p className="text-sm text-on-surface-variant">{timerContext}{timerTitle ? ` · ${timerTitle}` : ''}</p>
                <button
                  onClick={stopTimer}
                  className="rounded-full border border-red-200 bg-red-50 px-5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
                >
                  ⏹ Stop &amp; Opslaan
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <input
                  value={timerTitle}
                  onChange={(e) => setTimerTitle(e.target.value)}
                  placeholder="Beschrijving (optioneel)"
                  className="w-full rounded-lg border border-outline-variant bg-white px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                  style={{ fontSize: '16px' }}
                />
                <div className="flex gap-2">
                  <Select value={timerContext} onValueChange={setTimerContext}>
                    <SelectTrigger className="flex-1 rounded-lg px-3.5 py-2.5 text-sm" style={{ fontSize: '16px' }}>
                      <SelectValue placeholder="Context" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTEXT_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={startTimer}
                    className="flex-1 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230]"
                  >
                    ▶ Start
                  </button>
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="AI invoer" title="Snel toevoegen" description='"2u aan Prime Animals", "Van 19:00 tot 21:30 Sjoeli"' />
            <div className="mt-4 flex gap-2">
              <input
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAiInputEnhanced()}
                placeholder="Vertel wat je gedaan hebt..."
                className="flex-1 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={handleAiInputEnhanced}
                disabled={aiLoading || !aiText.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-white transition-colors hover:bg-[#2a3230] disabled:bg-surface-container-high disabled:text-on-surface-variant"
              >
                {aiLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
            {aiStatus && (
              <p className={cn('mt-2 text-xs font-medium', aiStatus.startsWith('✓') ? 'text-emerald-600' : 'text-amber-600')}>
                {aiStatus}
              </p>
            )}
            {aiProposal && (
              <div className="mt-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3">
                <p className="text-xs leading-6 text-on-surface-variant">{aiProposal.reply}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={confirmAiProposal}
                    disabled={aiLoading}
                    className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:opacity-50"
                  >
                    Bevestig
                  </button>
                  <button
                    onClick={() => setAiProposal(null)}
                    className="rounded-full border border-outline-variant bg-white px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-container-low"
                  >
                    Sluiten
                  </button>
                </div>
              </div>
            )}
          </Panel>

          {stats.length > 0 && (
            <Panel tone="muted">
              <PanelHeader eyebrow="Tijdverdeling" title="Per context" />
              <div className="mt-4 space-y-3">
                {stats.map((s) => {
                  const pct = Math.round((s.total_minutes / maxStatMinutes) * 100)
                  return (
                    <div key={s.context} className="flex items-center gap-3">
                      <span className="w-14 text-xs text-on-surface-variant">{s.context}</span>
                      <div className="flex-1 h-2 overflow-hidden rounded-full bg-surface-container">
                        <div className={cn('h-full rounded-full transition-all duration-500', CONTEXT_BAR[s.context] ?? 'bg-accent')} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-14 text-right text-xs font-bold text-on-surface">{formatDuration(s.total_minutes)}</span>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </PageShell>
  )
}
