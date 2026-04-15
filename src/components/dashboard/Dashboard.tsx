'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, FileText, TrendingUp, Activity, Clock, Inbox, Zap, Sparkles } from 'lucide-react'
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
    <div className="p-4 sm:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gradient leading-tight">
          {greeting()}, Daan
        </h1>
        <p className="text-gray-400 text-sm mt-1 capitalize font-medium">{today}</p>
      </div>

      {/* AI briefing */}
      {aiSummary && (
        <div className="mb-5 px-4 py-3 bg-gradient-to-r from-orange-50 to-pink-50 border border-pink-100 rounded-2xl flex items-start gap-2.5">
          <Sparkles size={14} className="text-pink-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-600 leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Urgent todos */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gradient flex items-center gap-2">
              <Clock size={14} />
              Urgent &amp; Vandaag
            </h2>
            <Link href="/todos" className="text-xs font-medium text-gradient hover:opacity-70 transition-opacity">
              Alle todos →
            </Link>
          </div>
          <div className="space-y-1">
            {!data?.urgentTodos?.length ? (
              <div className="text-center py-8">
                <p className="text-gray-400 text-sm font-medium">Niets urgent — lekker bezig! 🎉</p>
              </div>
            ) : (
              data.urgentTodos.map(todo => (
                <div key={todo.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <span className={cn('w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0', PRIORITY_DOT[todo.priority] || 'bg-gray-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-medium truncate">{todo.title}</p>
                    {todo.due_date && (
                      <p className={cn('text-xs mt-0.5', isOverdue(todo.due_date) ? 'text-red-400 font-medium' : 'text-gray-400')}>
                        {isOverdue(todo.due_date) ? '⚠ Te laat · ' : ''}{formatDate(todo.due_date)}
                      </p>
                    )}
                  </div>
                  {todo.project_title && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: (todo.project_color ?? '#888') + '18', color: todo.project_color ?? '#888' }}>
                      {todo.project_title}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4 sm:space-y-5">
          {/* Finance summary */}
          {data && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gradient flex items-center gap-2">
                  <TrendingUp size={14} />
                  Financiën deze maand
                </h2>
                <Link href="/finance" className="text-xs font-medium text-gradient hover:opacity-70 transition-opacity">Alles →</Link>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Inkomsten</span>
                  <span className="text-sm font-bold text-emerald-600">+{formatCurrency(data.stats.finance.monthIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Uitgaven</span>
                  <span className="text-sm font-bold text-red-500">-{formatCurrency(data.stats.finance.monthExpenses)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-500">Netto</span>
                  <span className={cn('text-sm font-extrabold', net >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}
                  </span>
                </div>
                {/* Mini bar */}
                {(data.stats.finance.monthIncome > 0 || data.stats.finance.monthExpenses > 0) && (
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div
                      className={cn('h-full rounded-full', net >= 0 ? 'bg-emerald-400' : 'bg-red-400')}
                      style={{ width: `${Math.min(100, Math.round(Math.abs(net) / Math.max(data.stats.finance.monthIncome, data.stats.finance.monthExpenses, 1) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Planning widget */}
          {planning && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="flex-shrink-0" style={{ color: '#ec4899' }} />
                <h2 className="text-sm font-bold text-gradient">Dagplanning</h2>
              </div>
              <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed line-clamp-6">{planning.recommendation.replace(/\*\*/g, '')}</p>
            </div>
          )}

          {/* Recente notes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gradient flex items-center gap-2">
                <FileText size={14} />
                Recente notes
              </h2>
              <Link href="/notes" className="text-xs font-medium text-gradient hover:opacity-70 transition-opacity">Alles →</Link>
            </div>
            {!data?.recentNotes?.length ? (
              <p className="text-gray-400 text-xs text-center py-3">Nog geen notes</p>
            ) : (
              <div className="space-y-0.5">
                {data.recentNotes.map(note => (
                  <Link key={note.id} href={`/notes/${note.id}`} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-gray-50 transition-colors">
                    <FileText size={12} className="text-gray-300 flex-shrink-0" />
                    <span className="text-xs text-gray-600 font-medium truncate hover:text-gradient">{note.title}</span>
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
    <Link href={href} className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm card-hover block">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 sm:mb-4 text-white shadow-sm"
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
      >
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-extrabold text-gradient leading-none mb-1">{prefix}{value}</p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={cn('text-xs mt-1 font-medium', alert ? 'text-red-400' : 'text-gray-400')}>{sub}</p>
    </Link>
  )
}
