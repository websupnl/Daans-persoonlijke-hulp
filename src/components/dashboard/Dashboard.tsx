'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Clock3,
  Euro,
  FolderOpen,
  Inbox,
  NotebookPen,
  Receipt,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { formatCurrency, formatRelative, isOverdue } from '@/lib/utils'
import { Tag, PriorityDot } from '@/components/ui/Card'
import { ActionPill, EmptyPanel, MetricTile, Panel, PanelHeader } from '@/components/ui/Panel'

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
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 17) return 'Goedemiddag'
  return 'Goedenavond'
}

function formatWork(minutes: number) {
  if (minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}u ${rest}m` : `${hours}u`
}

function buildSummary(data: DashboardData | null) {
  if (!data) return 'Je cockpit wordt opgebouwd. Zodra de data binnen is kun je meteen zien wat vandaag aandacht vraagt.'

  const { stats, inboxCount, todayWorkMinutes } = data
  const signals: string[] = []

  if (stats.todos.overdue > 0) {
    signals.push(`${stats.todos.overdue} taken zijn te laat`)
  } else if (stats.todos.dueToday > 0) {
    signals.push(`${stats.todos.dueToday} taken vragen vandaag aandacht`)
  }

  if (inboxCount > 0) {
    signals.push(`${inboxCount} items wachten nog in je inbox`)
  }

  if (stats.finance.openInvoices > 0) {
    signals.push(`${stats.finance.openInvoices} facturen staan nog open`)
  }

  if (todayWorkMinutes > 0) {
    signals.push(`je hebt al ${formatWork(todayWorkMinutes)} gewerkt`)
  }

  if (signals.length === 0) {
    return 'Er ligt geen acute rotzooi bovenop. Gebruik dit moment om bewust te kiezen waar je vandaag echt op wilt focussen.'
  }

  return `${signals.join(', ')}. Begin met het blok dat vandaag zowel urgent als bepalend is, en laat de rest even stil blijven.`
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [deepSyncLoading, setDeepSyncLoading] = useState(false)
  const [deepSyncDone, setDeepSyncDone] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .finally(() => setLoading(false))

    fetch('/api/ai/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dashboard' }),
    })
      .then((response) => response.json())
      .then((payload) => setAiSummary(payload.summary ?? null))
      .catch(() => {})
  }, [])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1380px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="grid gap-5">
          <Panel tone="accent" padding="lg" className="min-h-[240px] animate-pulse" />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">
            <Panel className="min-h-[360px] animate-pulse" />
            <div className="space-y-5">
              <Panel className="min-h-[180px] animate-pulse" />
              <Panel className="min-h-[180px] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const netThisMonth = (stats?.finance.monthIncome ?? 0) - (stats?.finance.monthExpenses ?? 0)
  const habitsLabel = stats?.habits.total
    ? `${stats.habits.completedToday}/${stats.habits.total} gedaan`
    : 'Nog geen gewoontes actief'
  const summary = aiSummary ?? buildSummary(data)
  const dateLabel = new Date().toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Panel tone="accent" padding="lg">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionPill>{dateLabel}</ActionPill>
              {(data?.inboxCount ?? 0) > 0 && <ActionPill>{data!.inboxCount} inbox</ActionPill>}
              {(stats?.finance.openInvoices ?? 0) > 0 && <ActionPill>{stats!.finance.openInvoices} open facturen</ActionPill>}
            </div>

            <h1 className="mt-4 text-3xl font-headline font-extrabold tracking-tight text-on-surface sm:text-[2.5rem]">
              {greeting()}, Daan
            </h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-on-surface-variant">
              Dit moet geen dashboard met losse widgets zijn, maar je dagelijkse stuurpaneel. Vandaag draait om focus, niet om meer ruis.
            </p>

            <div className="mt-5 rounded-[24px] border border-black/5 bg-white/[0.72] p-4 shadow-[0_20px_50px_-34px_rgba(31,37,35,0.24)] sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#202625] text-white">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant/75">
                    Dagbriefing
                  </p>
                  <p className="mt-2 text-sm leading-7 text-on-surface sm:text-[15px]">
                    {summary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <MetricTile
              label="Open taken"
              value={stats?.todos.open ?? 0}
              meta={
                (stats?.todos.overdue ?? 0) > 0
                  ? `${stats!.todos.overdue} te laat`
                  : `${stats?.todos.dueToday ?? 0} voor vandaag`
              }
              icon={<CheckSquare size={18} />}
            />
            <MetricTile
              label="Werk vandaag"
              value={formatWork(data?.todayWorkMinutes ?? 0)}
              meta={(data?.inboxCount ?? 0) > 0 ? `${data!.inboxCount} inbox-items open` : 'Geen losse eindjes in inbox'}
              icon={<Clock3 size={18} />}
            />
            <MetricTile
              label="Netto maand"
              value={formatCurrency(netThisMonth)}
              meta={`${formatCurrency(stats?.finance.monthIncome ?? 0)} in / ${formatCurrency(stats?.finance.monthExpenses ?? 0)} uit`}
              icon={<Euro size={18} />}
            />
            <MetricTile
              label="Routines"
              value={stats?.habits.completedToday ?? 0}
              meta={habitsLabel}
              icon={<Zap size={18} />}
            />
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_380px]">
        <div className="space-y-5">
          <Panel>
            <PanelHeader
              eyebrow="Focus"
              title="Wat nu aandacht vraagt"
              description="Geen eindeloze blokken. Alleen de dingen die vandaag daadwerkelijk besluitvorming vragen."
              action={
                <Link href="/todos" className="inline-flex items-center gap-1 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-low">
                  Alles bekijken
                  <ArrowRight size={13} />
                </Link>
              }
            />

            <div className="mt-5 space-y-3">
              {(data?.urgentTodos ?? []).length === 0 ? (
                <EmptyPanel
                  title="Geen acute taken"
                  description="Je todo-lijst heeft nu geen harde brandjes. Gebruik dit om bewust te kiezen wat de belangrijkste voortgang oplevert."
                />
              ) : (
                data!.urgentTodos.slice(0, 6).map((todo) => (
                  <Link
                    key={todo.id}
                    href="/todos"
                    className="block rounded-[24px] border border-black/5 bg-white/70 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low">
                        <CheckSquare size={16} className="text-on-surface" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-on-surface sm:text-[15px]">
                            {todo.title}
                          </p>
                          {todo.due_date && isOverdue(todo.due_date) && <Tag color="red">te laat</Tag>}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{todo.project_title || 'Geen project gekoppeld'}</span>
                          {todo.due_date && <span>deadline {todo.due_date}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <PriorityDot priority={todo.priority} />
                        <ArrowRight size={14} className="text-on-surface-variant" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Geld"
              title="Recente geldbewegingen"
              description="Snel zien wat er liep zonder eerst een heel financieel scherm te hoeven ontcijferen."
              action={
                <Link href="/finance" className="inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface">
                  Naar financiën
                  <ArrowRight size={13} />
                </Link>
              }
            />

            <div className="mt-5 space-y-3">
              {(data?.recentFinance ?? []).length === 0 ? (
                <EmptyPanel
                  title="Nog geen transacties"
                  description="Zodra er uitgaven of inkomsten binnenkomen, zie je hier direct de laatste bewegingen."
                />
              ) : (
                data!.recentFinance.slice(0, 5).map((item) => {
                  const positive = item.type === 'inkomst'
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-[24px] border border-black/5 bg-white/70 px-4 py-4"
                    >
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low">
                        <Receipt size={16} className="text-on-surface" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-on-surface sm:text-[15px]">{item.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                          <span>{item.category}</span>
                          <span>{formatRelative(item.created_at)}</span>
                        </div>
                      </div>
                      <p className={`shrink-0 text-sm font-bold ${positive ? 'text-emerald-600' : 'text-[#a55a2c]'}`}>
                        {positive ? '+' : '-'}
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  )
                })
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <PanelHeader
              eyebrow="Financieel"
              title="Facturen en cashflow"
              description="Openstaand geld en maandbeeld zonder ruis."
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile
                label="Openstaand"
                value={formatCurrency(stats?.finance.openAmount ?? 0)}
                meta={`${stats?.finance.openInvoices ?? 0} open facturen`}
                icon={<Receipt size={18} />}
              />
              <MetricTile
                label="Boodschappen"
                value={stats?.groceries.total ?? 0}
                meta="Items op de lijst"
                icon={<ShoppingCart size={18} />}
              />
            </div>

            {(data?.openInvoices ?? []).length > 0 && (
              <div className="mt-4 space-y-3">
                {data!.openInvoices.slice(0, 3).map((invoice) => (
                  <div key={invoice.id} className="rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">{invoice.title}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {invoice.contact_name || 'Geen contact'}{invoice.due_date ? ` • vervalt ${invoice.due_date}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-on-surface">{formatCurrency(invoice.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="Snel naar"
              title="Werkruimtes"
              description="De modules die je het meest gebruikt moeten direct aanvoelen als logische werkplekken."
            />

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {[
                { href: '/chat', label: 'Chat', description: 'Snelle opdrachten, vragen en acties', icon: Sparkles },
                { href: '/projects', label: 'Projecten', description: 'Actieve projecten en voortgang', icon: FolderOpen },
                { href: '/notes', label: 'Notities', description: 'Kennis, ideeën en losse context', icon: NotebookPen },
                { href: '/journal', label: 'Dagboek', description: 'Reflectie, energie en patronen', icon: BookOpen },
              ].map(({ href, label, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group rounded-[24px] border border-black/5 bg-white/70 px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-container-low text-on-surface">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-on-surface">{label}</p>
                      <p className="mt-1 text-xs leading-5 text-on-surface-variant">{description}</p>
                    </div>
                    <ArrowRight size={14} className="mt-1 text-on-surface-variant transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel tone={(stats?.todos.overdue ?? 0) > 0 ? 'warning' : 'default'}>
            <PanelHeader
              eyebrow="Recent"
              title="Bijgewerkte notities"
              description={(stats?.todos.overdue ?? 0) > 0 ? 'Er liggen ook te late taken. Laat notities nu ondersteunend zijn, niet nog een nieuw zijspoor.' : 'Snel terugvinden wat je recent hebt vastgelegd.'}
            />

            <div className="mt-5 space-y-3">
              {(data?.recentNotes ?? []).length === 0 ? (
                <EmptyPanel
                  title="Nog geen recente notities"
                  description="Zodra je notities gebruikt als tweede brein, wil je hier meteen je laatste context terugzien."
                />
              ) : (
                data!.recentNotes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="block rounded-[22px] border border-black/5 bg-white/70 px-4 py-3.5 transition-colors hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">{note.title}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">Bijgewerkt {formatRelative(note.updated_at)}</p>
                      </div>
                      {(stats?.todos.overdue ?? 0) > 0 && <TriangleAlert size={14} className="mt-1 text-[#a55a2c]" />}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
          className="inline-flex items-center gap-2 rounded-full bg-[#202625] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2a3230] disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
        >
          <Inbox size={15} />
          {deepSyncLoading ? 'Inbox sync bezig...' : deepSyncDone ? 'Inbox bijgewerkt' : 'Telegram deep sync'}
        </button>
        <Link href="/agenda" className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low">
          Agenda openen
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
