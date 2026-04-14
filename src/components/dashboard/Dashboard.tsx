'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, FileText, Users, Euro, Activity, AlertCircle, TrendingUp, Clock } from 'lucide-react'
import { cn, formatDate, formatCurrency, isOverdue } from '@/lib/utils'
import Link from 'next/link'

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

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
          subColor="text-slate-500"
          accent="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Urgent todos */}
        <div className="lg:col-span-2 bg-[#13151c] rounded-xl border border-white/5 p-4">
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
                <div key={todo.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/5 transition-colors group">
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
                      {inv.due_date && <p className={cn('text-[10px]', isOverdue(inv.due_date) ? 'text-red-400' : 'text-slate-600')}>{formatDate(inv.due_date)}</p>}
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
        </div>
      </div>
    </div>
  )
}

function StatCard({
  href, icon, label, value, sub, subColor, accent
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
