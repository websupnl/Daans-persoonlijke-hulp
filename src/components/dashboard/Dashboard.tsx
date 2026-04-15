'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, FileText, Euro, Activity, AlertCircle, TrendingUp, Clock, Sparkles, MessageSquare } from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import Link from 'next/link'
import type { Insight } from '@/app/api/ai/insights/route'

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

interface InsightsData {
  insights: Insight[]
  aiFocus: string | null
  ai_powered: boolean
  summary: { habitsToday: string; openTodos: number; overdueTodos: number; openFinance: number }
}

const PRIORITY_DOT: Record<string, string> = {
  hoog: 'bg-red-400',
  medium: 'bg-amber-400',
  laag: 'bg-emerald-400',
}

const INSIGHT_STYLES: Record<Insight['type'], string> = {
  success: 'border-emerald-800/40 bg-emerald-950/30 text-emerald-300',
  warning: 'border-amber-800/40 bg-amber-950/30 text-amber-300',
  error: 'border-red-800/40 bg-red-950/30 text-red-300',
  info: 'border-brand-800/40 bg-brand-950/20 text-brand-300',
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [insights, setInsights] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Laad dashboard en insights parallel
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/ai/insights').then(r => r.json()).catch(() => null),
    ]).then(([dashData, insightsData]) => {
      setData(dashData)
      setInsights(insightsData)
      setLoading(false)
    })
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
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stats = data?.stats

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">{greeting()}, Daan</h1>
        <p className="text-slate-500 text-sm mt-0.5 capitalize">{today}</p>
      </div>

      {/* AI Focus tip */}
      {insights?.aiFocus && (
        <div className="mb-5 p-4 rounded-xl bg-brand-950/40 border border-brand-800/30 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-brand-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles size={14} className="text-brand-400" />
          </div>
          <div>
            <p className="text-[11px] text-brand-500 font-medium mb-0.5">AI Focus voor vandaag</p>
            <p className="text-sm text-slate-300">{insights.aiFocus}</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard
          href="/todos"
          icon={<CheckSquare size={18} />}
          label="Open todos"
          value={stats?.todos.open ?? 0}
          sub={stats?.todos.overdue ? `${stats.todos.overdue} te laat` : stats?.todos.dueToday ? `${stats.todos.dueToday} vandaag` : 'Alles op schema'}
          subColor={stats?.todos.overdue ? 'text-red-400' : 'text-slate-500'}
          accent="brand"
        />
        <StatCard
          href="/finance"
          icon={<Euro size={18} />}
          label="Open facturen"
          value={formatCurrency(stats?.finance.openAmount ?? 0)}
          sub={`${stats?.finance.openInvoices ?? 0} facturen open`}
          subColor={stats?.finance.openInvoices ? 'text-amber-400' : 'text-slate-500'}
          accent="amber"
        />
        <StatCard
          href="/notes"
          icon={<FileText size={18} />}
          label="Notes"
          value={stats?.notes.total ?? 0}
          sub="kennisbank"
          subColor="text-slate-500"
          accent="violet"
        />
        <StatCard
          href="/habits"
          icon={<Activity size={18} />}
          label="Gewoontes"
          value={`${stats?.habits.completedToday ?? 0}/${stats?.habits.total ?? 0}`}
          sub="vandaag gedaan"
          subColor={
            stats && stats.habits.total > 0 && stats.habits.completedToday === stats.habits.total
              ? 'text-emerald-400'
              : 'text-slate-500'
          }
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Urgent todos */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#13151c] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Clock size={14} className="text-brand-400" />
                Urgent & Vandaag
              </h2>
              <Link href="/todos" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Alle todos →
              </Link>
            </div>
            <div className="space-y-1.5">
              {!data?.urgentTodos?.length ? (
                <div className="text-center py-6">
                  <p className="text-slate-600 text-sm">Niets urgent — lekker bezig! 🎉</p>
                </div>
              ) : (
                data.urgentTodos.map(todo => (
                  <div key={todo.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', PRIORITY_DOT[todo.priority] || 'bg-slate-500')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300 truncate">{todo.title}</p>
                      {todo.due_date && (
                        <p className={cn('text-xs mt-0.5', isOverdue(todo.due_date) ? 'text-red-400' : 'text-slate-600')}>
                          {isOverdue(todo.due_date) ? '⚠ Te laat · ' : ''}{formatDate(todo.due_date)}
                        </p>
                      )}
                    </div>
                    {todo.project_title && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: todo.project_color + '22', color: todo.project_color }}>
                        {todo.project_title}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Insights */}
          {insights?.insights && insights.insights.length > 0 && (
            <div className="bg-[#13151c] rounded-xl border border-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-400" />
                  Inzichten
                </h2>
                {insights.ai_powered && (
                  <span className="text-[10px] text-brand-500">AI-aangedreven</span>
                )}
              </div>
              <div className="space-y-2">
                {insights.insights.map((insight, i) => (
                  <div key={i} className={cn('text-xs px-3 py-2 rounded-lg border', INSIGHT_STYLES[insight.type])}>
                    {insight.icon} {insight.text}
                  </div>
                ))}
              </div>
              <Link
                href="/chat"
                className="mt-3 flex items-center gap-2 text-xs text-slate-600 hover:text-brand-400 transition-colors"
              >
                <MessageSquare size={11} />
                Vraag de AI om meer uitleg →
              </Link>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Open facturen */}
          <div className="bg-[#13151c] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <AlertCircle size={14} className="text-amber-400" />
                Open facturen
              </h2>
              <Link href="/finance" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Alles →
              </Link>
            </div>
            {!data?.openInvoices?.length ? (
              <p className="text-slate-600 text-xs text-center py-3">Geen openstaande facturen</p>
            ) : (
              <div className="space-y-1.5">
                {data.openInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-1">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-300 truncate">{inv.contact_name || inv.title}</p>
                      {inv.due_date && (
                        <p className={cn('text-[10px]', isOverdue(inv.due_date) ? 'text-red-400' : 'text-slate-600')}>
                          {formatDate(inv.due_date)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-amber-400 ml-2 flex-shrink-0">{formatCurrency(inv.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recente notes */}
          <div className="bg-[#13151c] rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <TrendingUp size={14} className="text-violet-400" />
                Recente notes
              </h2>
              <Link href="/notes" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Alles →
              </Link>
            </div>
            {!data?.recentNotes?.length ? (
              <p className="text-slate-600 text-xs text-center py-3">Nog geen notes</p>
            ) : (
              <div className="space-y-1">
                {data.recentNotes.map(note => (
                  <Link key={note.id} href={`/notes/${note.id}`} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-white/5 transition-colors">
                    <FileText size={12} className="text-slate-600 flex-shrink-0" />
                    <span className="text-xs text-slate-400 truncate">{note.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Snel naar chat */}
          <Link
            href="/chat"
            className="flex items-center gap-3 p-3 bg-brand-950/30 border border-brand-800/20 rounded-xl hover:bg-brand-950/50 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center">
              <Sparkles size={14} className="text-brand-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">Vraag de AI</p>
              <p className="text-[10px] text-slate-600">Analyseer je dag of stel vragen</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  href, icon, label, value, sub, subColor, accent,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  subColor: string
  accent: 'brand' | 'amber' | 'violet' | 'emerald'
}) {
  const accentClasses = {
    brand: 'text-brand-400 bg-brand-950/50',
    amber: 'text-amber-400 bg-amber-950/40',
    violet: 'text-violet-400 bg-violet-950/40',
    emerald: 'text-emerald-400 bg-emerald-950/40',
  }

  return (
    <Link href={href} className="bg-[#13151c] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-all hover:-translate-y-0.5 duration-150">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', accentClasses[accent])}>
        {icon}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      <p className={cn('text-xs mt-1', subColor)}>{sub}</p>
    </Link>
  )
}
