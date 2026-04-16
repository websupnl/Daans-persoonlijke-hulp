'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, FileText, TrendingUp, Activity, Clock, Inbox, Zap, Sparkles, TrendingDown } from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import Link from 'next/link'

interface PlanningData {
  type: string
  recommendation: string
  overdueCount: number
}

interface DashboardData {
  stats: {
    todos: { total: number; open: number; dueToday: number; overdue: number }
    notes: { total: number }
    contacts: { total: number }
    finance: { openInvoices: number; openAmount: number; monthIncome: number; monthExpenses: number }
    habits: { total: number; completedToday: number }
  }
  urgentTodos: Array<{ id: number; title: string; priority: string; due_date?: string; project_color?: string; project_title?: string }>
  recentNotes: Array<{ id: number; title: string; updated_at: string }>
  openInvoices: Array<{ id: number; title: string; amount: number; due_date?: string; status: string; contact_name?: string }>
  recentFinance: Array<{ id: number; title: string; amount: number; type: string; category: string; due_date?: string; created_at: string }>
  todayWorkMinutes: number
  inboxCount: number
}

const PRIORITY_DOT: Record<string, string> = {
  hoog: 'bg-red-400',
  medium: 'bg-amber-400',
  laag: 'bg-emerald-400',
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [inboxCount, setInboxCount] = useState(0)
  const [planning, setPlanning] = useState<PlanningData | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [deepSyncLoading, setDeepSyncLoading] = useState(false)
  const [deepSyncDone, setDeepSyncDone] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/planning?type=day').then(r => r.json()).catch(() => null),
    ]).then(([dash, plan]) => {
      setData(dash)
      setTodayMinutes(dash.todayWorkMinutes ?? 0)
      setInboxCount(dash.inboxCount ?? 0)
      setPlanning(plan)
    }).finally(() => setLoading(false))

    // AI briefing
    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dashboard' }),
    })
      .then(r => r.json())
      .then(d => setAiSummary(d.summary ?? null))
      .catch(() => {})
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Goedemorgen'
    if (h < 17) return 'Goedemiddag'
    return 'Goedenavond'
  }

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
      </div>
    )
  }

  const stats = data?.stats
  const net = (data?.stats.finance.monthIncome ?? 0) - (data?.stats.finance.monthExpenses ?? 0)

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gradient leading-tight">
          {greeting()}, Daan
        </h1>
        <p className="text-gray-400 text-sm mt-1 capitalize font-medium">{today}</p>
      </div>

      {/* Daily AI Briefing */}
      {aiSummary && (
        <div className="mb-8 p-6 bg-gradient-to-br from-orange-50 via-pink-50 to-white border border-pink-100 rounded-3xl shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={120} className="text-pink-400" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center text-pink-500">
                <Sparkles size={18} />
              </div>
              <h2 className="text-sm font-bold text-pink-500 uppercase tracking-wider">Dagelijkse Briefing</h2>
            </div>
            <p className="text-lg sm:text-xl font-medium text-gray-700 leading-relaxed max-w-4xl">
              {aiSummary}
            </p>
          </div>
        </div>
      )}

      {/* Proactive Brain Controls */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            setDeepSyncLoading(true)
            try {
              await fetch('/api/telegram/deep-sync', { method: 'POST' })
              setDeepSyncDone(true)
              setTimeout(() => setDeepSyncDone(false), 5000)
            } finally {
              setDeepSyncLoading(false)
            }
          }}
          disabled={deepSyncLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold rounded-xl shadow hover:opacity-90 disabled:opacity-50 transition-all"
        >
          <Zap size={12} />
          {deepSyncLoading ? 'Bezig...' : deepSyncDone ? '✓ Rapport verstuurd' : 'Deep Sync'}
        </button>
        <button
          onClick={async () => {
            const res = await fetch('/api/cron/pulse')
            if (res.ok) alert('Pulse uitgevoerd — check Telegram')
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-all"
        >
          <Activity size={12} />
          Test Pulse
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8 sm:mb-10">
        <StatCard
          href="/todos"
          icon={<CheckSquare size={18} />}
          label="Open todos"
          value={stats?.todos.open ?? 0}
          sub={stats?.todos.overdue ? `${stats.todos.overdue} te laat` : stats?.todos.dueToday ? `${stats.todos.dueToday} vandaag` : 'Alles op schema'}
          alert={!!stats?.todos.overdue}
        />
        <StatCard
          href="/finance"
          icon={<TrendingUp size={18} />}
          label="Netto deze maand"
          value={formatCurrency(Math.abs(net))}
          sub={net >= 0 ? 'positief saldo' : 'negatief saldo'}
          alert={net < 0}
          prefix={net >= 0 ? '+' : '-'}
        />
        <StatCard
          href="/notes"
          icon={<FileText size={18} />}
          label="Notes"
          value={stats?.notes.total ?? 0}
          sub="in kennisbank"
        />
        <StatCard
          href="/habits"
          icon={<Activity size={18} />}
          label="Gewoontes"
          value={`${stats?.habits.completedToday ?? 0}/${stats?.habits.total ?? 0}`}
          sub="vandaag gedaan"
          alert={(stats?.habits.completedToday ?? 0) < (stats?.habits.total ?? 0) && new Date().getHours() >= 20}
        />
        <StatCard
          href="/worklogs"
          icon={<Clock size={18} />}
          label="Werklog vandaag"
          value={todayMinutes >= 60 ? `${Math.floor(todayMinutes / 60)}u ${todayMinutes % 60}m` : `${todayMinutes}m`}
          sub="gelogd vandaag"
        />
        <StatCard
          href="/inbox"
          icon={<Inbox size={18} />}
          label="Inbox"
          value={inboxCount}
          sub={inboxCount > 0 ? 'onverwerkt' : 'leeg'}
          alert={inboxCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent todos */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-pink-500" />
              Urgent &amp; Vandaag
            </h2>
            <Link href="/todos" className="text-xs font-semibold text-pink-500 hover:opacity-70 transition-opacity">
              Alle todos →
            </Link>
          </div>
          <div className="space-y-1">
            {!data?.urgentTodos?.length ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm font-medium">Niets urgent — lekker bezig! 🎉</p>
              </div>
            ) : (
              data.urgentTodos.map(todo => (
                <div key={todo.id} className="flex items-start gap-4 p-3 rounded-2xl hover:bg-gray-50 transition-colors group">
                  <span className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', PRIORITY_DOT[todo.priority] || 'bg-gray-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-bold truncate">{todo.title}</p>
                    {todo.due_date && (
                      <p className={cn('text-xs mt-0.5', isOverdue(todo.due_date) ? 'text-red-400 font-bold' : 'text-gray-400')}>
                        {isOverdue(todo.due_date) ? '⚠ Te laat · ' : ''}{formatDate(todo.due_date)}
                      </p>
                    )}
                  </div>
                  {todo.project_title && (
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-bold" style={{ background: (todo.project_color ?? '#888') + '15', color: todo.project_color ?? '#888' }}>
                      {todo.project_title}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Finance summary */}
          {data && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500" />
                  Financiën
                </h2>
                <Link href="/finance" className="text-xs font-semibold text-emerald-500 hover:opacity-70 transition-opacity">Overzicht →</Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-400">Inkomsten</span>
                  <span className="text-sm font-bold text-emerald-600">+{formatCurrency(data.stats.finance.monthIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-400">Uitgaven</span>
                  <span className="text-sm font-bold text-red-500">-{formatCurrency(data.stats.finance.monthExpenses)}</span>
                </div>
                <div className="border-t border-gray-50 pt-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500">Netto</span>
                  <span className={cn('text-sm font-extrabold', net >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}
                  </span>
                </div>

                {/* Recent transactions */}
                {data.recentFinance && data.recentFinance.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Recente transacties</p>
                    <div className="space-y-3">
                      {data.recentFinance.map(f => (
                        <div key={f.id} className="flex justify-between items-center group">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-600 truncate">{f.title}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{f.category}</p>
                          </div>
                          <span className={cn('text-xs font-bold ml-2', f.type === 'inkomst' ? 'text-emerald-600' : 'text-red-500')}>
                            {f.type === 'inkomst' ? '+' : '-'}{formatCurrency(f.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Planning widget */}
          {planning && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-violet-500" />
                <h2 className="text-base font-bold text-gray-800">Dagplanning</h2>
              </div>
              <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">{planning.recommendation.replace(/\*\*/g, '')}</p>
            </div>
          )}

          {/* Recente notes */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                Recente notes
              </h2>
              <Link href="/notes" className="text-xs font-semibold text-blue-500 hover:opacity-70 transition-opacity">Alle →</Link>
            </div>
            {!data?.recentNotes?.length ? (
              <p className="text-gray-400 text-xs text-center py-4">Nog geen notes</p>
            ) : (
              <div className="space-y-1">
                {data.recentNotes.map(note => (
                  <Link key={note.id} href={`/notes/${note.id}`} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors group">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-400 group-hover:bg-blue-100 transition-colors">
                      <FileText size={12} />
                    </div>
                    <span className="text-xs text-gray-600 font-bold truncate group-hover:text-blue-500 transition-colors">{note.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  href, icon, label, value, sub, alert = false, prefix,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  alert?: boolean
  prefix?: string
}) {
  return (
    <Link href={href} className="bg-white rounded-3xl border border-gray-100 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all block group">
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 text-white shadow-sm group-hover:scale-110 transition-transform"
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
      >
        {icon}
      </div>
      <p className="text-2xl sm:text-3xl font-extrabold text-gradient leading-none mb-1">{prefix}{value}</p>
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{label}</p>
      <p className={cn('text-xs mt-2 font-medium', alert ? 'text-red-400' : 'text-gray-400')}>{sub}</p>
    </Link>
  )
}
