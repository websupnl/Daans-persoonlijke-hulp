'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, BookOpen, CheckSquare, Clock3,
  Euro, FolderOpen, Inbox, NotebookPen,
  Receipt, ShoppingCart, Sparkles, TriangleAlert, Zap,
} from 'lucide-react'
import { formatCurrency, formatRelative, isOverdue } from '@/lib/utils'
import { Tag, PriorityDot } from '@/components/ui/card'
import {
  AICard, EmptyPanel, MetricTile,
  Panel, PanelHeader, SectionHeader,
} from '@/components/ui/Panel'
import { LinkButton } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 17) return 'Goedemiddag'
  return 'Goedenavond'
}

function formatWork(minutes: number) {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? (m ? `${h}u ${m}m` : `${h}u`) : `${m}m`
}

function buildSummary(data: DashboardData | null) {
  if (!data) return 'Je cockpit wordt geladen...'
  const { stats, inboxCount, todayWorkMinutes } = data
  const signals: string[] = []
  if (stats.todos.overdue > 0) signals.push(`${stats.todos.overdue} taken zijn te laat`)
  else if (stats.todos.dueToday > 0) signals.push(`${stats.todos.dueToday} taken vragen vandaag aandacht`)
  if (inboxCount > 0) signals.push(`${inboxCount} items wachten in je inbox`)
  if (stats.finance.openInvoices > 0) signals.push(`${stats.finance.openInvoices} facturen staan nog open`)
  if (todayWorkMinutes > 0) signals.push(`je hebt al ${formatWork(todayWorkMinutes)} gewerkt`)
  if (signals.length === 0) return 'Geen acute aandachtspunten. Gebruik dit moment om bewust te kiezen waar je vandaag echt op wilt focussen.'
  return `${signals.join(', ')}. Begin met het blok dat vandaag zowel urgent als bepalend is.`
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-5">
      <div className="rounded-xl border border-outline-variant bg-white p-6 min-h-[160px] animate-pulse" />
      <div className="grid gap-5 grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-outline-variant bg-white h-24 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="rounded-xl border border-outline-variant bg-white min-h-[320px] animate-pulse" />
        <div className="space-y-5">
          <div className="rounded-xl border border-outline-variant bg-white h-44 animate-pulse" />
          <div className="rounded-xl border border-outline-variant bg-white h-44 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [deepSyncLoading, setDeepSyncLoading] = useState(false)
  const [deepSyncDone, setDeepSyncDone] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))

    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dashboard' }),
    })
      .then(r => r.json())
      .then(p => setAiSummary(p.summary ?? null))
      .catch(() => {})
  }, [])

  if (loading) return <DashboardSkeleton />

  const stats      = data?.stats
  const netMonth   = (stats?.finance.monthIncome ?? 0) - (stats?.finance.monthExpenses ?? 0)
  const summary    = aiSummary ?? buildSummary(data)
  const hasOverdue = (stats?.todos.overdue ?? 0) > 0
  const dateLabel  = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in">

      {/* ── HERO ROW ─────────────────────────────────────────────────────────── */}
      <Panel tone="accent" padding="lg">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">

          {/* Left: greeting + AI briefing */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-white px-2.5 py-1 text-[11px] font-medium text-on-surface-variant">
                {dateLabel}
              </span>
              {(data?.inboxCount ?? 0) > 0 && (
                <Link href="/inbox" className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-bg px-2.5 py-1 text-[11px] font-medium text-warning">
                  <Inbox size={11} />
                  {data!.inboxCount} inbox
                </Link>
              )}
              {hasOverdue && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/20 bg-danger-bg px-2.5 py-1 text-[11px] font-medium text-danger">
                  <TriangleAlert size={11} />
                  {stats!.todos.overdue} te laat
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">
              {greeting()}, Daan
            </h1>

            {/* AI dagbriefing */}
            <div className="mt-4">
              <AICard label="Dagbriefing" className="max-w-2xl">
                {summary}
              </AICard>
            </div>
          </div>

          {/* Right: metric grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              label="Open taken"
              value={stats?.todos.open ?? 0}
              meta={hasOverdue ? `${stats!.todos.overdue} te laat` : `${stats?.todos.dueToday ?? 0} vandaag`}
              icon={<CheckSquare size={16} />}
              trend={hasOverdue ? 'down' : undefined}
            />
            <MetricTile
              label="Werk vandaag"
              value={formatWork(data?.todayWorkMinutes ?? 0)}
              meta={(data?.inboxCount ?? 0) > 0 ? `${data!.inboxCount} in inbox` : 'Inbox leeg'}
              icon={<Clock3 size={16} />}
            />
            <MetricTile
              label="Netto maand"
              value={formatCurrency(netMonth)}
              meta={`${formatCurrency(stats?.finance.monthIncome ?? 0)} in`}
              icon={<Euro size={16} />}
              trend={netMonth > 0 ? 'up' : netMonth < 0 ? 'down' : 'flat'}
            />
            <MetricTile
              label="Routines"
              value={`${stats?.habits.completedToday ?? 0}/${stats?.habits.total ?? 0}`}
              meta={stats?.habits.total ? 'Vandaag gedaan' : 'Geen gewoontes'}
              icon={<Zap size={16} />}
            />
          </div>
        </div>
      </Panel>

      {/* ── MAIN GRID ────────────────────────────────────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">

        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* Urgent todos */}
          <Panel>
            <PanelHeader
              eyebrow="Focus"
              title="Wat nu aandacht vraagt"
              description="Alleen de taken die vandaag besluitvorming vragen."
              action={
                <LinkButton href="/todos" variant="secondary" size="sm" iconRight={<ArrowRight size={12} />}>
                  Alle taken
                </LinkButton>
              }
            />

            <div className="mt-4 space-y-2">
              {(data?.urgentTodos ?? []).length === 0 ? (
                <EmptyPanel
                  title="Geen acute taken"
                  description="Je todo-lijst heeft geen brandjes. Kies bewust wat de belangrijkste voortgang oplevert."
                />
              ) : (
                data!.urgentTodos.slice(0, 6).map(todo => (
                  <Link
                    key={todo.id}
                    href="/todos"
                    className="group flex items-start gap-3 rounded-lg border border-outline-variant bg-white px-4 py-3.5 transition-all duration-150 card-hover"
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                      <CheckSquare size={14} className="text-on-surface-variant" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-on-surface">{todo.title}</p>
                        {todo.due_date && isOverdue(todo.due_date) && (
                          <span className="inline-flex items-center rounded-full border border-danger/20 bg-danger-bg px-2 py-0.5 text-[10px] font-medium text-danger">
                            te laat
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-on-surface-variant">
                        {todo.project_title || 'Geen project'}{todo.due_date ? ` • ${todo.due_date}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityDot priority={todo.priority} />
                      <ArrowRight size={13} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>

          {/* Recent finance */}
          <Panel>
            <PanelHeader
              eyebrow="Geld"
              title="Recente geldbewegingen"
              action={
                <LinkButton href="/finance" variant="ghost" size="sm" iconRight={<ArrowRight size={12} />}>
                  Financiën
                </LinkButton>
              }
            />

            <div className="mt-4 space-y-2">
              {(data?.recentFinance ?? []).length === 0 ? (
                <EmptyPanel
                  title="Nog geen transacties"
                  description="Zodra er uitgaven of inkomsten zijn, zie je hier de laatste bewegingen."
                />
              ) : (
                data!.recentFinance.slice(0, 5).map(item => {
                  const positive = item.type === 'inkomst'
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-outline-variant bg-white px-4 py-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container">
                        <Receipt size={14} className="text-on-surface-variant" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-on-surface truncate">{item.title}</p>
                        <p className="mt-0.5 text-[11px] text-on-surface-variant">
                          {item.category} • {formatRelative(item.created_at)}
                        </p>
                      </div>
                      <p className={`shrink-0 text-[13px] font-bold ${positive ? 'text-success' : 'text-on-surface'}`}>
                        {positive ? '+' : '-'}{formatCurrency(item.amount)}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </Panel>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-5">

          {/* Finance snapshot */}
          <Panel>
            <PanelHeader
              eyebrow="Financieel"
              title="Facturen & cashflow"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile
                label="Openstaand"
                value={formatCurrency(stats?.finance.openAmount ?? 0)}
                meta={`${stats?.finance.openInvoices ?? 0} open facturen`}
                icon={<Receipt size={16} />}
              />
              <MetricTile
                label="Boodschappen"
                value={stats?.groceries.total ?? 0}
                meta="Items op de lijst"
                icon={<ShoppingCart size={16} />}
              />
            </div>

            {(data?.openInvoices ?? []).length > 0 && (
              <div className="mt-4 space-y-2">
                <SectionHeader title="Open facturen" className="mb-2" />
                {data!.openInvoices.slice(0, 3).map(invoice => (
                  <div key={invoice.id} className="rounded-lg border border-outline-variant bg-white px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-on-surface">{invoice.title}</p>
                        <p className="mt-0.5 text-[11px] text-on-surface-variant">
                          {invoice.contact_name || 'Geen contact'}
                          {invoice.due_date ? ` • vervalt ${invoice.due_date}` : ''}
                        </p>
                      </div>
                      <p className="text-[13px] font-bold text-on-surface shrink-0">
                        {formatCurrency(invoice.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Quick workspace links */}
          <Panel>
            <PanelHeader
              eyebrow="Snel naar"
              title="Werkruimtes"
            />
            <div className="mt-4 space-y-2">
              {[
                { href: '/chat',     label: 'Chat',      description: 'Snelle opdrachten en acties', icon: Sparkles },
                { href: '/projects', label: 'Projecten', description: 'Actieve projecten en voortgang', icon: FolderOpen },
                { href: '/notes',    label: 'Notities',  description: 'Kennis, ideeën en context', icon: NotebookPen },
                { href: '/journal',  label: 'Dagboek',   description: 'Reflectie, energie en patronen', icon: BookOpen },
              ].map(({ href, label, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3 rounded-lg border border-outline-variant bg-white px-3.5 py-3 transition-all duration-150 card-hover"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-on-surface">{label}</p>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">{description}</p>
                  </div>
                  <ArrowRight
                    size={13}
                    className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  />
                </Link>
              ))}
            </div>
          </Panel>

          {/* Recent notes */}
          <Panel tone={hasOverdue ? 'warning' : 'default'}>
            <PanelHeader
              eyebrow="Recent"
              title="Bijgewerkte notities"
              description={hasOverdue ? 'Er liggen ook te late taken.' : undefined}
            />
            <div className="mt-4 space-y-2">
              {(data?.recentNotes ?? []).length === 0 ? (
                <EmptyPanel
                  title="Nog geen recente notities"
                  description="Zodra je notities schrijft, zie je hier de laatste context terug."
                />
              ) : (
                data!.recentNotes.map(note => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="block rounded-lg border border-outline-variant bg-white px-3.5 py-3 transition-colors hover:bg-surface-container-low"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-on-surface">{note.title}</p>
                        <p className="mt-0.5 text-[11px] text-on-surface-variant">
                          Bijgewerkt {formatRelative(note.updated_at)}
                        </p>
                      </div>
                      {hasOverdue && <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warning" />}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── BOTTOM ACTIONS ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <button
          onClick={async () => {
            setDeepSyncLoading(true)
            try {
              await fetch('/api/telegram/deep-sync', { method: 'POST' })
              setDeepSyncDone(true)
              setTimeout(() => setDeepSyncDone(false), 4000)
            } finally {
              setDeepSyncLoading(false)
            }
          }}
          disabled={deepSyncLoading}
          className="inline-flex items-center gap-2 rounded-md bg-on-surface px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Inbox size={14} />
          {deepSyncLoading ? 'Sync bezig...' : deepSyncDone ? 'Bijgewerkt ✓' : 'Telegram deep sync'}
        </button>
        <LinkButton href="/agenda" variant="secondary" size="sm" iconRight={<ArrowRight size={12} />}>
          Agenda
        </LinkButton>
      </div>
    </div>
  )
}
