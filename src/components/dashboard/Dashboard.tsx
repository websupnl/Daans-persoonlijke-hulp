'use client'

import { useEffect, useState } from 'react'
import {
  CheckSquare, Activity, Clock, Inbox, Zap, Sparkles,
  ArrowRight, Euro, FolderOpen, BookOpen, TrendingUp, TrendingDown
} from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import Link from 'next/link'
import { Card, CardLow, StatChip, Tag, PriorityDot } from '@/components/ui/Card'
import { Sparkline, DonutRing, MiniBarChart, TrendBadge } from '@/components/ui/MiniChart'
import AIContextButton from '@/components/ai/AIContextButton'

interface DashboardData {
  stats: {
    todos: { total: number; open: number; dueToday: number; overdue: number }
    notes: { total: number }
    contacts: { total: number }
    finance: { openInvoices: number; openAmount: number; monthIncome: number; monthExpenses: number }
    habits: { total: number; completedToday: number }
    groceries: { total: number }
  }
  urgentTodos: Array<{ id: number; title: string; priority: string; due_date?: string; project_title?: string }>
  recentNotes: Array<{ id: number; title: string; updated_at: string }>
  openInvoices: Array<{ id: number; title: string; amount: number; due_date?: string; status: string; contact_name?: string }>
  recentFinance: Array<{ id: number; title: string; amount: number; type: string; category: string; due_date?: string; created_at: string }>
  todayWorkMinutes: number
  inboxCount: number
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 17) return 'Goedemiddag'
  return 'Goedenavond'
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [deepSyncLoading, setDeepSyncLoading] = useState(false)
  const [deepSyncDone, setDeepSyncDone] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d) })
      .finally(() => setLoading(false))

    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dashboard' }),
    })
      .then(r => r.json())
      .then(d => setAiSummary(d.summary ?? null))
      .catch(() => {})
  }, [])

  const today = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  const stats   = data?.stats
  const net     = (stats?.finance.monthIncome ?? 0) - (stats?.finance.monthExpenses ?? 0)
  const habitPct = stats?.habits.total ? Math.round((stats.habits.completedToday / stats.habits.total) * 100) : 0

  // Fake sparkline data for finance (real data would come from API)
  const financeSparkData = data?.recentFinance
    ? data.recentFinance.slice(-7).map(f => f.type === 'inkomst' ? f.amount : -f.amount)
    : [0, 0, 0, 0, 0]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#ec4899 transparent #ec4899 #ec4899' }} />
          <p className="text-xs text-on-surface-variant">Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight leading-tight">
            {greeting()}, Daan
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              setDeepSyncLoading(true)
              try { await fetch('/api/telegram/deep-sync', { method: 'POST' }); setDeepSyncDone(true); setTimeout(() => setDeepSyncDone(false), 4000) }
              finally { setDeepSyncLoading(false) }
            }}
            disabled={deepSyncLoading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl btn-gradient text-xs font-semibold disabled:opacity-50"
          >
            <Zap size={11} />
            {deepSyncLoading ? 'Bezig...' : deepSyncDone ? '✓ Klaar' : 'Sync'}
          </button>
        </div>
      </div>

      {/* ── AI Insight card ── */}
      {aiSummary && (
        <Card className="relative overflow-hidden p-5">
          {/* Gradient blob */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl bg-pink-200/40 pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full blur-2xl bg-orange-200/30 pointer-events-none" />
          <div className="relative z-10 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-subtle flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={15} className="icon-gradient" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Dagelijkse briefing</p>
              <p className="text-sm font-medium text-on-surface leading-relaxed">{aiSummary}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Bento grid row 1: Key stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/todos" className="block">
          <Card compact glow className="h-full hover:scale-[1.01] transition-transform">
            <div className="flex items-start justify-between mb-2">
              <CheckSquare size={16} className="text-orange-400" />
              {(stats?.todos.overdue ?? 0) > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                  {stats!.todos.overdue} te laat
                </span>
              )}
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface">{stats?.todos.open ?? 0}</p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">open todos</p>
            {(stats?.todos.dueToday ?? 0) > 0 && (
              <p className="text-[10px] text-orange-500 mt-1">{stats!.todos.dueToday} vandaag</p>
            )}
          </Card>
        </Link>

        <Link href="/finance" className="block">
          <Card compact glow className="h-full hover:scale-[1.01] transition-transform">
            <div className="flex items-start justify-between mb-2">
              <Euro size={16} className={net >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              <TrendBadge delta={net >= 0 ? Math.round((net / Math.max(stats?.finance.monthIncome ?? 1, 1)) * 100) : -100} />
            </div>
            <p className={cn('font-headline text-xl font-extrabold', net >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              {formatCurrency(Math.abs(net))}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">netto deze maand</p>
            <Sparkline data={financeSparkData.map(v => Math.abs(v))} width={70} height={20} color={net >= 0 ? '#10b981' : '#ef4444'} className="mt-2" />
          </Card>
        </Link>

        <Link href="/habits" className="block">
          <Card compact glow className="h-full hover:scale-[1.01] transition-transform">
            <div className="flex items-start justify-between mb-1">
              <Activity size={16} className="text-violet-400" />
              <DonutRing
                value={stats?.habits.completedToday ?? 0}
                max={stats?.habits.total ?? 1}
                size={32}
                strokeWidth={4}
                color="#a78bfa"
                label={`${habitPct}%`}
              />
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface">
              {stats?.habits.completedToday ?? 0}<span className="text-sm font-medium text-on-surface-variant">/{stats?.habits.total ?? 0}</span>
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">gewoontes vandaag</p>
          </Card>
        </Link>

        <Link href="/worklogs" className="block">
          <Card compact glow className="h-full hover:scale-[1.01] transition-transform">
            <div className="flex items-start justify-between mb-2">
              <Clock size={16} className="text-teal-400" />
            </div>
            <p className="font-headline text-2xl font-extrabold text-on-surface">
              {data?.todayWorkMinutes && data.todayWorkMinutes >= 60
                ? `${Math.floor(data.todayWorkMinutes / 60)}u`
                : `${data?.todayWorkMinutes ?? 0}m`}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">gelogd vandaag</p>
            {(data?.inboxCount ?? 0) > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Inbox size={10} className="text-amber-400" />
                <span className="text-[10px] text-amber-500">{data!.inboxCount} inbox</span>
              </div>
            )}
          </Card>
        </Link>
      </div>

      {/* ── Bento grid row 2: Todos + Finance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Urgent todos */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline text-sm font-bold text-on-surface">Actieve taken</h2>
            <Link href="/todos" className="text-[11px] text-on-surface-variant hover:text-on-surface flex items-center gap-0.5">
              Alles <ArrowRight size={11} />
            </Link>
          </div>
          {(data?.urgentTodos ?? []).length === 0 ? (
            <p className="text-xs text-on-surface-variant py-3 text-center">Geen urgente taken</p>
          ) : (
            <div className="space-y-1">
              {(data?.urgentTodos ?? []).slice(0, 5).map(todo => (
                <div key={todo.id} className="group flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-surface-container transition-colors">
                  <div className="w-5 h-5 rounded-full border-2 border-outline-variant/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{todo.title}</p>
                    {todo.project_title && (
                      <p className="text-[10px] text-on-surface-variant">{todo.project_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {todo.due_date && isOverdue(todo.due_date) && (
                      <Tag color="red">te laat</Tag>
                    )}
                    <PriorityDot priority={todo.priority} />
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <AIContextButton type="todo" title={todo.title} id={todo.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Finance summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline text-sm font-bold text-on-surface">Financiën</h2>
            <Link href="/finance" className="text-[11px] text-on-surface-variant hover:text-on-surface flex items-center gap-0.5">
              Alles <ArrowRight size={11} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <CardLow compact className="rounded-xl">
              <p className="text-[10px] text-on-surface-variant">Inkomsten</p>
              <p className="font-headline text-base font-bold text-emerald-600 mt-0.5">{formatCurrency(stats?.finance.monthIncome ?? 0)}</p>
            </CardLow>
            <CardLow compact className="rounded-xl">
              <p className="text-[10px] text-on-surface-variant">Uitgaven</p>
              <p className="font-headline text-base font-bold text-red-500 mt-0.5">{formatCurrency(stats?.finance.monthExpenses ?? 0)}</p>
            </CardLow>
          </div>
          {(stats?.finance.openInvoices ?? 0) > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-xl">
              <p className="text-xs text-amber-700">{stats!.finance.openInvoices} open factuur/facturen</p>
              <p className="text-xs font-bold text-amber-700">{formatCurrency(stats?.finance.openAmount ?? 0)}</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Projects + Journal quick-links ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Recent finance transactions */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-headline text-sm font-bold text-on-surface">Recente transacties</h2>
            <Link href="/finance" className="text-[11px] text-on-surface-variant hover:text-on-surface flex items-center gap-0.5">
              Meer <ArrowRight size={11} />
            </Link>
          </div>
          {(data?.recentFinance ?? []).length === 0 ? (
            <p className="text-xs text-on-surface-variant py-2 text-center">Geen transacties</p>
          ) : (
            <div className="space-y-1">
              {data!.recentFinance.slice(0, 4).map(f => (
                <div key={f.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-surface-container transition-colors">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', f.type === 'inkomst' ? 'bg-emerald-100' : 'bg-red-100')}>
                    {f.type === 'inkomst'
                      ? <TrendingUp size={12} className="text-emerald-600" />
                      : <TrendingDown size={12} className="text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{f.title}</p>
                    <p className="text-[10px] text-on-surface-variant">{f.category}</p>
                  </div>
                  <p className={cn('text-sm font-semibold shrink-0', f.type === 'inkomst' ? 'text-emerald-600' : 'text-red-500')}>
                    {f.type === 'inkomst' ? '+' : '-'}{formatCurrency(f.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick links */}
        <div className="space-y-3">
          <Link href="/projects">
            <CardLow className="p-3 hover:bg-surface-container transition-colors cursor-pointer rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
                  <FolderOpen size={15} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Projecten</p>
                  <p className="text-[10px] text-on-surface-variant">Actieve projecten</p>
                </div>
                <ArrowRight size={14} className="text-on-surface-variant ml-auto" />
              </div>
            </CardLow>
          </Link>
          <Link href="/journal">
            <CardLow className="p-3 hover:bg-surface-container transition-colors cursor-pointer rounded-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center">
                  <BookOpen size={15} className="text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Dagboek</p>
                  <p className="text-[10px] text-on-surface-variant">Schrijf vandaag</p>
                </div>
                <ArrowRight size={14} className="text-on-surface-variant ml-auto" />
              </div>
            </CardLow>
          </Link>
          <Link href="/inbox">
            <CardLow className={cn('p-3 transition-colors cursor-pointer rounded-2xl', (data?.inboxCount ?? 0) > 0 ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-surface-container')}>
              <div className="flex items-center gap-2.5">
                <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', (data?.inboxCount ?? 0) > 0 ? 'bg-amber-200' : 'bg-surface-container-high')}>
                  <Inbox size={15} className={(data?.inboxCount ?? 0) > 0 ? 'text-amber-700' : 'text-on-surface-variant'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-on-surface">Inbox</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {(data?.inboxCount ?? 0) > 0 ? `${data!.inboxCount} onverwerkt` : 'Leeg'}
                  </p>
                </div>
                {(data?.inboxCount ?? 0) > 0 && (
                  <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded-full">
                    {data!.inboxCount}
                  </span>
                )}
              </div>
            </CardLow>
          </Link>
        </div>
      </div>

    </div>
  )
}
