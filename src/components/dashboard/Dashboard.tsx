'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, FileText, TrendingUp, Activity, Clock, Inbox, Zap, Sparkles, TrendingDown, ShoppingCart } from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import Link from 'next/link'
import IntelligenceModule from './IntelligenceModule'
import { StatsCard, LightCard, CompactListItem, ProgressIndicator } from '@/components/ui/DesignSystem'

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
    groceries: { total: number }
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

      {/* Stat cards - nieuw lightweight design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Open Todos"
          value={stats?.todos.open ?? 0}
          subtitle={stats?.todos.overdue ? `${stats.todos.overdue} te laat` : stats?.todos.dueToday ? `${stats.todos.dueToday} vandaag` : 'Alles op schema'}
          icon={<CheckSquare size={18} />}
          trend={stats?.todos.overdue ? 'down' : 'neutral'}
        />
        <StatsCard
          title="Netto Maand"
          value={formatCurrency(Math.abs(net))}
          subtitle={net >= 0 ? 'positief saldo' : 'negatief saldo'}
          icon={<TrendingUp size={18} />}
          trend={net >= 0 ? 'up' : 'down'}
        />
        <StatsCard
          title="Notes"
          value={stats?.notes.total ?? 0}
          subtitle="in kennisbank"
          icon={<FileText size={18} />}
        />
        <StatsCard
          title="Gewoontes"
          value={`${stats?.habits.completedToday ?? 0}/${stats?.habits.total ?? 0}`}
          subtitle="vandaag gedaan"
          icon={<Activity size={18} />}
          trend={(stats?.habits.completedToday ?? 0) < (stats?.habits.total ?? 0) && new Date().getHours() >= 20 ? 'down' : 'neutral'}
        />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <StatsCard
          title="Werklog Vandaag"
          value={todayMinutes >= 60 ? `${Math.floor(todayMinutes / 60)}u ${todayMinutes % 60}m` : `${todayMinutes}m`}
          subtitle="gelogd vandaag"
          icon={<Clock size={18} />}
        />
        <StatsCard
          title="Inbox"
          value={inboxCount}
          subtitle={inboxCount > 0 ? 'onverwerkt' : 'leeg'}
          icon={<Inbox size={18} />}
          trend={inboxCount > 0 ? 'down' : 'neutral'}
        />
        <StatsCard
          title="Boodschappen"
          value={stats?.groceries.total ?? 0}
          subtitle="items op lijst"
          icon={<ShoppingCart size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent todos - lightweight design */}
        <LightCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Clock size={16} className="text-pink-500" />
              Urgent & Vandaag
            </h2>
            <Link href="/todos" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Alle todos →
            </Link>
          </div>
          <div className="space-y-1">
            {!data?.urgentTodos?.length ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm font-medium">Niets urgent — lekker bezig! 🎉</p>
              </div>
            ) : (
              data.urgentTodos.map(todo => (
                <CompactListItem 
                  key={todo.id} 
                  hover={true}
                  onClick={() => window.location.href = `/todos`}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT[todo.priority] || 'bg-gray-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-medium truncate">{todo.title}</p>
                    {todo.due_date && (
                      <p className={cn('text-xs mt-0.5', isOverdue(todo.due_date) ? 'text-red-500 font-medium' : 'text-gray-500')}>
                        {isOverdue(todo.due_date) ? '⚠ Te laat · ' : ''}{formatDate(todo.due_date)}
                      </p>
                    )}
                  </div>
                  {todo.project_title && (
                    <span className="text-[10px] px-2 py-1 rounded-md font-medium" style={{ background: (todo.project_color ?? '#888') + '15', color: todo.project_color ?? '#888' }}>
                      {todo.project_title}
                    </span>
                  )}
                </CompactListItem>
              ))
            )}
          </div>
        </LightCard>

        {/* Right column */}
        <div className="space-y-6">
          <IntelligenceModule />
          {/* Finance summary - lightweight */}
          {data && (
            <LightCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-500" />
                  Financiën
                </h2>
                <Link href="/finance" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Overzicht →</Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Inkomsten</span>
                  <span className="text-sm font-bold text-emerald-600">+{formatCurrency(data.stats.finance.monthIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Uitgaven</span>
                  <span className="text-sm font-bold text-red-500">-{formatCurrency(data.stats.finance.monthExpenses)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Netto</span>
                  <span className={cn('text-sm font-bold', net >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}
                  </span>
                </div>
              </div>
            </LightCard>
          )}

          {/* Planning widget - lightweight */}
          {planning && (
            <LightCard>
              <div className="flex items-center gap-2 mb-4">
                <Zap size={16} className="text-violet-500" />
                <h2 className="text-base font-bold text-gray-800">Dagplanning</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{planning.recommendation.replace(/\*\*/g, '')}</p>
            </LightCard>
          )}

          {/* Recente notes - lightweight */}
          <LightCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <FileText size={16} className="text-blue-500" />
                Recente Notes
              </h2>
              <Link href="/notes" className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">Alle →</Link>
            </div>
            {!data?.recentNotes?.length ? (
              <p className="text-gray-500 text-sm text-center py-4">Nog geen notes</p>
            ) : (
              <div className="space-y-1">
                {data.recentNotes.map(note => (
                  <CompactListItem 
                    key={note.id} 
                    hover={true}
                    onClick={() => window.location.href = `/notes/${note.id}`}
                  >
                    <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-600">
                      <FileText size={12} />
                    </div>
                    <span className="text-sm text-gray-700 font-medium truncate">{note.title}</span>
                  </CompactListItem>
                ))}
              </div>
            )}
          </LightCard>
        </div>
      </div>
    </div>
  )
}

