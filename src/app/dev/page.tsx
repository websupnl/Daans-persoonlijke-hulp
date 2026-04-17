'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: number; role: string; content: string
  actions: Array<{ type: string; [k: string]: unknown }>
  created_at: string
}
interface Theory {
  id: number; category: string; theory: string; confidence: number
  status: string; times_confirmed: number; impact_score: number
  action_potential: string | null; created_at: string; last_updated: string
}
interface Memory {
  id: number; key: string; value: string; category: string
  confidence: number; last_reinforced_at: string
}
interface Observation {
  obs_date: string; module: string; metric_key: string; metric_value: number
}
interface Session {
  session_key: string; last_domain: string | null
  last_result: Record<string, unknown>; updated_at: string
}
interface ProactiveLog {
  id: number; trigger_type: string; telegram_sent: number; created_at: string
}
interface FinanceStat { type: string; total: number; count: number }
interface HabitStat { name: string; completed_today: number; streak_7d: number }
interface TodoStats { open: number; overdue: number; high: number; completed_today: number }
interface BrainData {
  messages: Message[]; theories: Theory[]; memories: Memory[]
  observations: Observation[]; sessions: Session[]; proactiveLog: ProactiveLog[]
  financeStats: FinanceStat[]; habitStats: HabitStat[]; todoStats: TodoStats | null
  meta: { timestamp: string; messageCount: number; theoryCount: number; memoryCount: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  confirmed: '#22c55e', hypothesis: '#f59e0b', rejected: '#ef4444', unknown: '#6b7280',
}
const statusBg: Record<string, string> = {
  confirmed: 'bg-green-500/15 border-green-500/30 text-green-300',
  hypothesis: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  rejected: 'bg-red-500/15 border-red-500/30 text-red-400',
}
const triggerIcon: Record<string, string> = {
  morning_briefing: '☀️', weekly_report: '📊', deep_sync: '🧠',
  overdue_spike: '📋', finance_silence: '💰', finance_anomaly: '💸',
  journal_silence: '📔', habit_streak_break: '⭐', inbox_overflow: '📥',
  user_silence: '👋',
}
const moduleColor: Record<string, string> = {
  finance: '#f59e0b', todos: '#3b82f6', work: '#8b5cf6', journal: '#ec4899',
  habits: '#22c55e', notes: '#06b6d4', projects: '#f97316',
}
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'nu'
  if (m < 60) return `${m}m geleden`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}u geleden`
  return `${Math.floor(h / 24)}d geleden`
}
function ConfBar({ value, color = '#f97316' }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
      <span className="text-xs text-white/50 w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  )
}

// ─── Mini sparkline SVG ────────────────────────────────────────────────────────
function Sparkline({ values, color = '#f97316', h = 28, w = 80 }: { values: number[]; color?: string; h?: number; w?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').at(-1)?.split(',')[0]} cy={pts.split(' ').at(-1)?.split(',')[1]} r="2.5" fill={color} />
    </svg>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, accent = '#f97316' }: { icon: string; title: string; count?: number; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icon}</span>
      <h2 className="text-sm font-semibold tracking-widest uppercase text-white/70">{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-mono" style={{ background: `${accent}22`, color: accent }}>{count}</span>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DevPage() {
  const [data, setData] = useState<BrainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [tab, setTab] = useState<'overview' | 'theories' | 'memory' | 'chat' | 'proactive'>('overview')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dev/brain-data')
      if (res.ok) { setData(await res.json()); setLastRefresh(new Date()) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin mx-auto mb-4" />
        <p className="text-white/40 text-sm">Brain laden...</p>
      </div>
    </div>
  )

  const theories = data?.theories ?? []
  const memories = data?.memories ?? []
  const messages = data?.messages ?? []
  const proactiveLog = data?.proactiveLog ?? []
  const sessions = data?.sessions ?? []
  const observations = data?.observations ?? []
  const habitStats = data?.habitStats ?? []
  const financeStats = data?.financeStats ?? []
  const todoStats = data?.todoStats

  const confirmedTheories = theories.filter(t => t.status === 'confirmed')
  const hypothesisTheories = theories.filter(t => t.status === 'hypothesis')
  const rejectedTheories = theories.filter(t => t.status === 'rejected')

  // Aggregate observations by module + metric for sparklines
  const obsMap: Record<string, number[]> = {}
  for (const o of [...observations].reverse()) {
    const k = `${o.module}:${o.metric_key}`
    obsMap[k] = [...(obsMap[k] ?? []), o.metric_value]
  }

  const uitgaven = financeStats.find(f => f.type === 'expense' || f.type === 'uitgave')
  const inkomsten = financeStats.find(f => f.type === 'inkomst' || f.type === 'income')

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'theories', label: '🔬 Theories' },
    { id: 'memory', label: '🧠 Memory' },
    { id: 'chat', label: '💬 Chat Log' },
    { id: 'proactive', label: '📡 Proactive' },
  ] as const

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans antialiased">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#f97316,#ec4899,#a78bfa)' }}>🧠</div>
            <span className="font-semibold text-sm">Brain Dashboard</span>
            <span className="text-white/20 text-xs">DEV</span>
          </div>
          <div className="flex gap-1 ml-4">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-white/30 text-xs">Ververst {relTime(lastRefresh.toISOString())}</span>
            <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-white/60">↻ Refresh</button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-6">

        {/* ═══════════════════════════════════════════════════════════ OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-6">

            {/* KPI row */}
            <div className="grid grid-cols-6 gap-3">
              {[
                { label: 'Open taken', value: todoStats?.open ?? '—', sub: `${todoStats?.overdue ?? 0} achterstallig`, color: '#3b82f6' },
                { label: 'Hoog prio', value: todoStats?.high ?? '—', sub: `${todoStats?.completed_today ?? 0} vandaag klaar`, color: '#ef4444' },
                { label: 'Theorieën', value: theories.length, sub: `${confirmedTheories.length} bevestigd`, color: '#22c55e' },
                { label: 'Memories', value: memories.length, sub: 'in geheugen', color: '#8b5cf6' },
                { label: 'Uitgaven', value: uitgaven ? `€${Math.round(uitgaven.total)}` : '—', sub: 'deze maand', color: '#f59e0b' },
                { label: 'Inkomsten', value: inkomsten ? `€${Math.round(inkomsten.total)}` : '—', sub: 'deze maand', color: '#10b981' },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <div className="text-xs text-white/40 mb-1">{kpi.label}</div>
                  <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                  <div className="text-xs text-white/30 mt-0.5">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Three columns: observations, sessions, habits */}
            <div className="grid grid-cols-3 gap-4">

              {/* Pattern observations sparklines */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                <SectionHeader icon="📈" title="Observaties (14d)" count={Object.keys(obsMap).length} accent="#8b5cf6" />
                <div className="space-y-3">
                  {Object.entries(obsMap).slice(0, 10).map(([k, vals]) => {
                    const [mod, metric] = k.split(':')
                    const last = vals.at(-1) ?? 0
                    const color = moduleColor[mod] ?? '#6b7280'
                    return (
                      <div key={k} className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white/50 truncate">{mod} · {metric}</div>
                        </div>
                        <Sparkline values={vals} color={color} w={60} h={20} />
                        <span className="text-xs font-mono text-white/60 w-10 text-right">{typeof last === 'number' ? last.toFixed(last < 10 ? 1 : 0) : last}</span>
                      </div>
                    )
                  })}
                  {Object.keys(obsMap).length === 0 && <p className="text-white/30 text-xs">Geen observaties</p>}
                </div>
              </div>

              {/* Active sessions */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                <SectionHeader icon="💬" title="Actieve sessies" count={sessions.length} accent="#3b82f6" />
                <div className="space-y-3">
                  {sessions.map(s => (
                    <div key={s.session_key} className="rounded-lg bg-white/4 border border-white/6 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-white/60 truncate">{s.session_key}</span>
                        <span className="text-xs text-white/30">{relTime(s.updated_at)}</span>
                      </div>
                      {s.last_domain && (
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full" style={{ background: `${moduleColor[s.last_domain] ?? '#6b7280'}22`, color: moduleColor[s.last_domain] ?? '#9ca3af' }}>
                          {s.last_domain}
                        </span>
                      )}
                      {s.last_result && Object.keys(s.last_result).length > 0 && (
                        <div className="mt-2 text-xs text-white/30 font-mono truncate">
                          {JSON.stringify(s.last_result).slice(0, 80)}
                        </div>
                      )}
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="text-white/30 text-xs">Geen actieve sessies</p>}
                </div>
              </div>

              {/* Habits */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-5">
                <SectionHeader icon="⭐" title="Gewoontes vandaag" count={habitStats.length} accent="#22c55e" />
                <div className="space-y-3">
                  {habitStats.map(h => (
                    <div key={h.name} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${h.completed_today ? 'bg-green-500/20 text-green-400' : 'bg-white/6 text-white/20'}`}>
                        {h.completed_today ? '✓' : '○'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/70 truncate">{h.name}</div>
                        <ConfBar value={h.streak_7d / 7} color={h.completed_today ? '#22c55e' : '#6b7280'} />
                      </div>
                      <span className="text-xs text-white/30">{h.streak_7d}/7</span>
                    </div>
                  ))}
                  {habitStats.length === 0 && <p className="text-white/30 text-xs">Geen gewoontes</p>}
                </div>
              </div>
            </div>

            {/* Theory distribution donut (CSS) */}
            <div className="rounded-xl border border-white/8 bg-white/3 p-5">
              <SectionHeader icon="🔬" title="Theorie status" accent="#f59e0b" />
              <div className="flex items-center gap-8">
                <div className="flex gap-4">
                  {[
                    { label: 'Bevestigd', count: confirmedTheories.length, color: '#22c55e' },
                    { label: 'Hypothese', count: hypothesisTheories.length, color: '#f59e0b' },
                    { label: 'Verworpen', count: rejectedTheories.length, color: '#ef4444' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className="text-3xl font-bold" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden flex">
                  {theories.length > 0 && <>
                    <div style={{ width: `${confirmedTheories.length / theories.length * 100}%`, background: '#22c55e' }} className="h-full transition-all" />
                    <div style={{ width: `${hypothesisTheories.length / theories.length * 100}%`, background: '#f59e0b' }} className="h-full transition-all" />
                    <div style={{ width: `${rejectedTheories.length / theories.length * 100}%`, background: '#ef4444' }} className="h-full transition-all" />
                  </>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {Array.from(new Set(theories.map(t => t.category))).slice(0, 8).map(cat => (
                    <span key={cat} className="text-xs px-2 py-0.5 rounded-full bg-white/6 text-white/50">{cat}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ THEORIES */}
        {tab === 'theories' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[
                { label: 'Bevestigd', items: confirmedTheories, color: '#22c55e' },
                { label: 'Hypothese', items: hypothesisTheories, color: '#f59e0b' },
                { label: 'Verworpen', items: rejectedTheories, color: '#ef4444' },
              ].map(col => (
                <div key={col.label} className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">{col.label}</span>
                    <span className="ml-auto text-xs font-mono" style={{ color: col.color }}>{col.items.length}</span>
                  </div>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {col.items.map(t => (
                      <div key={t.id} className={`rounded-lg border p-3 text-xs ${statusBg[t.status] ?? 'bg-white/4 border-white/8 text-white/60'}`}>
                        <div className="font-medium leading-snug mb-2">{t.theory}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="opacity-60">{t.category}</span>
                          <span className="ml-auto opacity-60">{Math.round(t.confidence * 100)}%</span>
                        </div>
                        <ConfBar value={t.confidence} color={col.color} />
                        {t.action_potential && <div className="mt-2 opacity-60 italic">{t.action_potential}</div>}
                        <div className="mt-1 opacity-40 text-[10px]">{relTime(t.last_updated)} · {t.times_confirmed}× bevestigd</div>
                      </div>
                    ))}
                    {col.items.length === 0 && <p className="text-white/20 text-xs">Geen theorieën</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ MEMORY */}
        {tab === 'memory' && (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-white/40 text-sm">{memories.length} memories opgeslagen</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {memories.map(m => (
                <div key={m.id} className="rounded-xl border border-white/8 bg-white/3 p-4 hover:bg-white/5 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-xs font-mono text-white/40">{m.key}</div>
                      <div className="text-sm text-white/80 mt-0.5 leading-snug">{m.value}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/6 text-white/40 flex-shrink-0">{m.category}</span>
                  </div>
                  <ConfBar value={m.confidence} color={m.confidence > 0.7 ? '#22c55e' : m.confidence > 0.4 ? '#f59e0b' : '#6b7280'} />
                  <div className="text-[10px] text-white/20 mt-1">{relTime(m.last_reinforced_at)}</div>
                </div>
              ))}
              {memories.length === 0 && <p className="text-white/30">Geen memories</p>}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ CHAT LOG */}
        {tab === 'chat' && (
          <div className="max-w-3xl">
            <SectionHeader icon="💬" title="Recente chat beslissingen" count={messages.length} />
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`rounded-xl border p-4 ${m.role === 'user' ? 'border-white/8 bg-white/3' : 'border-orange-500/15 bg-orange-500/5'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold ${m.role === 'user' ? 'text-blue-400' : 'text-orange-400'}`}>
                      {m.role === 'user' ? '👤 Daan' : '🤖 Assistent'}
                    </span>
                    <span className="text-white/20 text-xs ml-auto">{relTime(m.created_at)}</span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">{m.content}</p>
                  {m.role === 'assistant' && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.actions.map((a, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/50 font-mono">{a.type}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ PROACTIVE */}
        {tab === 'proactive' && (
          <div>
            <SectionHeader icon="📡" title="Proactieve log" count={proactiveLog.length} accent="#ec4899" />
            <div className="space-y-2">
              {proactiveLog.map(log => (
                <div key={log.id} className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                  <span className="text-lg w-6 text-center flex-shrink-0">{triggerIcon[log.trigger_type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white/70 font-medium">{log.trigger_type.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.telegram_sent === 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400">Telegram ✓</span>
                    )}
                    <span className="text-xs text-white/30 w-24 text-right">{relTime(log.created_at)}</span>
                  </div>
                </div>
              ))}
              {proactiveLog.length === 0 && <p className="text-white/30">Geen log items</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
