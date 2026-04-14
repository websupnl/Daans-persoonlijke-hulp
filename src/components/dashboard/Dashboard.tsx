'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, FileText, Euro, Activity, AlertCircle, TrendingUp, Clock, Inbox, Zap } from 'lucide-react'
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
    finance: { openInvoices: number; openAmount: number; monthIncome: number }
    habits: { total: number; completedToday: number }
  }
  urgentTodos: Array<{ id: number; title: string; priority: string; due_date?: string; project_color?: string; project_title?: string }>
  recentNotes: Array<{ id: number; title: string; updated_at: string }>
  openInvoices: Array<{ id: number; title: string; amount: number; due_date?: string; status: string; contact_name?: string }>
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

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))

    fetch('/api/worklogs')
      .then(r => r.json())
      .then(d => setTodayMinutes(d.todayStats?.today_minutes ?? 0))
      .catch(() => {})

    fetch('/api/inbox')
      .then(r => r.json())
      .then(d => setInboxCount(d.pendingCount ?? 0))
      .catch(() => {})

    fetch('/api/planning?type=day')
      .then(r => r.json())
      .then(setPlanning)
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

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gradient leading-tight">
          {greeting()}, Daan
        </h1>
        <p className="text-gray-400 text-sm mt-1 capitalize font-medium">{today}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
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
          icon={<Euro size={18} />}
          label="Open facturen"
          value={formatCurrency(stats?.finance.openAmount ?? 0)}
          sub={`${stats?.finance.openInvoices ?? 0} facturen open`}
          alert={!!stats?.finance.openInvoices}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: todo.project_color + '18', color: todo.project_color }}>
                      {todo.project_title}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Open facturen */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gradient flex items-center gap-2">
                <AlertCircle size={14} />
                Open facturen
              </h2>
              <Link href="/finance" className="text-xs font-medium text-gradient hover:opacity-70 transition-opacity">
                Alles →
              </Link>
            </div>
            {!data?.openInvoices?.length ? (
              <p className="text-gray-400 text-xs text-center py-3">Geen openstaande facturen</p>
            ) : (
              <div className="space-y-2">
                {data.openInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-1">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 font-medium truncate">{inv.contact_name || inv.title}</p>
                      {inv.due_date && <p className={cn('text-[10px] mt-0.5', isOverdue(inv.due_date) ? 'text-red-400 font-medium' : 'text-gray-400')}>{formatDate(inv.due_date)}</p>}
                    </div>
                    <span className="text-xs font-bold text-gradient ml-2 flex-shrink-0">{formatCurrency(inv.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Planning widget */}
          {planning && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover">
              <div className="flex items-center gap-2 mb-4">
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
                <TrendingUp size={14} />
                Recente notes
              </h2>
              <Link href="/notes" className="text-xs font-medium text-gradient hover:opacity-70 transition-opacity">
                Alles →
              </Link>
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
  href, icon, label, value, sub, alert = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  alert?: boolean
}) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm card-hover block"
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 text-white shadow-sm"
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #a78bfa 100%)' }}
      >
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-gradient leading-none mb-1">{value}</p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={cn('text-xs mt-1 font-medium', alert ? 'text-red-400' : 'text-gray-400')}>{sub}</p>
    </Link>
  )
}
