'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckSquare,
  Euro,
  HeartPulse,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { formatCurrency, formatRelative } from '@/lib/utils'
import { AICard, EmptyPanel, Panel, PanelHeader } from '@/components/ui/Panel'
import { LinkButton } from '@/components/ui/button'
import { Tag } from '@/components/ui/card'

interface DashboardData {
  stats: {
    todos: { total: number; open: number; dueToday: number; overdue: number }
    finance: { openInvoices: number; openAmount: number; monthIncome: number; monthExpenses: number }
  }
  urgentTodos: Array<{ id: number; title: string; priority: string; due_date?: string }>
  recentFinance: Array<{ id: number; title: string; amount: number; type: string; category: string; created_at: string }>
  inboxCount: number
}

interface ActivityItem {
  id: number
  action: string
  summary: string
  entity_type: string
  created_at: string
}

interface EventItem {
  id: number
  title: string
  date: string
  time?: string | null
}

const quickLogOptions = [
  { icon: HeartPulse, label: 'Stemming', href: '/journal' },
  { icon: Sparkles, label: 'Energie', href: '/journal' },
  { icon: NotebookPen, label: 'Notitie', href: '/notes' },
  { icon: CheckSquare, label: 'Taak', href: '/todos' },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

function briefingText(data: DashboardData | null) {
  if (!data) return 'Je briefing wordt samengesteld.'

  const parts: string[] = []
  if (data.urgentTodos.length > 0) {
    parts.push(`Je hebt vandaag ${data.urgentTodos.length} focuspunten openstaan.`)
  }
  if (data.stats.todos.overdue > 0) {
    parts.push(`${data.stats.todos.overdue} taken zijn over datum.`)
  }
  if (data.stats.finance.monthExpenses > 0) {
    parts.push(`Je uitgaven deze maand staan op ${formatCurrency(data.stats.finance.monthExpenses)}.`)
  }
  if (data.inboxCount > 0) {
    parts.push(`Daarnaast wachten ${data.inboxCount} inbox-items nog op triage.`)
  }

  return parts.length > 0
    ? parts.join(' ')
    : 'Vandaag oogt rustig. Gebruik de ruimte om bewust één belangrijk ding af te ronden.'
}

function activityTone(entityType: string) {
  if (entityType === 'todo') return 'bg-accent'
  if (entityType === 'finance') return 'bg-warning'
  if (entityType === 'journal') return 'bg-success'
  return 'bg-info'
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [dashboardRes, activityRes, eventRes, summaryRes] = await Promise.all([
        fetch('/api/dashboard').then((response) => response.json()),
        fetch('/api/activity?limit=6').then((response) => response.json()).catch(() => ({ data: [] })),
        fetch(`/api/events?date=${new Date().toISOString().split('T')[0]}`).then((response) => response.json()).catch(() => ({ data: [] })),
        fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'dashboard' }),
        }).then((response) => response.json()).catch(() => ({ summary: null })),
      ])

      setData(dashboardRes)
      setActivity(activityRes.data || [])
      setEvents((eventRes.data || []).slice(0, 4))
      setAiSummary(summaryRes.summary ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date()),
    []
  )

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="h-36 animate-pulse rounded-lg bg-surface" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-44 animate-pulse rounded-lg bg-surface" />
          <div className="h-44 animate-pulse rounded-lg bg-surface" />
          <div className="h-44 animate-pulse rounded-lg bg-surface" />
        </div>
        <div className="h-48 animate-pulse rounded-lg bg-surface" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-content px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-3xl font-extrabold tracking-tight text-text-primary">
          {greeting()}, Daan.
        </p>
        <p className="mt-2 text-sm text-text-secondary">{dateLabel}</p>
      </div>

      <div className="space-y-4">
        <AICard label="AI Briefing" generatedAt={new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}>
          {aiSummary ?? briefingText(data)}
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/todos" variant="ghost" size="sm">Bekijk taken</LinkButton>
            <LinkButton href="/finance" variant="ghost" size="sm">Bekijk financiën</LinkButton>
            <button onClick={load} className="focus-ring inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary">
              <RefreshCw size={12} />
              Vernieuwen
            </button>
          </div>
        </AICard>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel tone="muted">
            <PanelHeader eyebrow="Focus vandaag" title="Belangrijkste taken" />
            <div className="mt-4 space-y-3">
              {data?.urgentTodos.slice(0, 3).map((todo) => (
                <Link key={todo.id} href="/todos" className="block rounded-lg bg-surface px-4 py-3 transition-colors hover:bg-surface-hover">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-4 w-4 rounded-full border border-border-strong" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">{todo.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Tag color="gray">{todo.priority}</Tag>
                        {todo.due_date && <Tag color="blue">{todo.due_date}</Tag>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              {(!data || data.urgentTodos.length === 0) && (
                <EmptyPanel title="Geen focustaken" description="Er staat nu niets urgents bovenaan." />
              )}
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader eyebrow="Agenda" title="Vandaag gepland" />
            <div className="mt-4 space-y-3">
              {events.length > 0 ? events.map((event) => (
                <div key={event.id} className="rounded-lg bg-surface px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                    {event.time || 'Hele dag'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{event.title}</p>
                </div>
              )) : (
                <EmptyPanel title="Geen afspraken" description="Je agenda is vandaag nog leeg." />
              )}
            </div>
          </Panel>

          <Panel tone="muted">
            <PanelHeader eyebrow="Quick log" title="Leg iets vast" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {quickLogOptions.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-lg bg-surface px-4 py-4 transition-colors hover:bg-surface-hover"
                >
                  <item.icon size={18} className="text-text-secondary" />
                  <p className="mt-3 text-sm font-semibold text-text-primary">{item.label}</p>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel>
            <PanelHeader eyebrow="Recente activiteit" title="Laatste 24 uur" />
            <div className="mt-4 space-y-4">
              {activity.length > 0 ? activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 rounded-full ${activityTone(item.entity_type)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-3">
                      <span className="w-14 shrink-0 text-xs text-text-tertiary">{formatRelative(item.created_at)}</span>
                      <p className="text-sm text-text-primary">{item.summary || item.action}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <EmptyPanel title="Nog geen activiteit" description="Zodra de AI of jij iets vastlegt, verschijnt het hier." />
              )}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel>
              <PanelHeader eyebrow="Vandaag in cijfers" title="Snelle status" />
              <div className="mt-4 grid gap-3">
                <div className="rounded-lg bg-surface-inset px-4 py-3">
                  <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Taken</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{data?.stats.todos.open ?? 0}</p>
                </div>
                <div className="rounded-lg bg-surface-inset px-4 py-3">
                  <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Uitgaven</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{formatCurrency(data?.stats.finance.monthExpenses ?? 0)}</p>
                </div>
                <div className="rounded-lg bg-surface-inset px-4 py-3">
                  <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Open facturen</p>
                  <p className="mt-2 text-2xl font-bold text-text-primary">{data?.stats.finance.openInvoices ?? 0}</p>
                </div>
              </div>
            </Panel>

            <Panel tone="ai">
              <PanelHeader eyebrow="Dagelijks" title="Ga verder waar je was" />
              <div className="mt-4 space-y-2">
                <LinkButton href="/chat" variant="ai" size="md" className="w-full justify-between">
                  <span className="inline-flex items-center gap-2"><MessageSquare size={16} /> Chat</span>
                  <ArrowRight size={14} />
                </LinkButton>
                <LinkButton href="/journal" variant="secondary" size="md" className="w-full justify-between">
                  <span className="inline-flex items-center gap-2"><BookOpen size={16} /> Dagboek</span>
                  <ArrowRight size={14} />
                </LinkButton>
                <LinkButton href="/finance" variant="secondary" size="md" className="w-full justify-between">
                  <span className="inline-flex items-center gap-2"><Euro size={16} /> Financiën</span>
                  <ArrowRight size={14} />
                </LinkButton>
                <LinkButton href="/agenda" variant="secondary" size="md" className="w-full justify-between">
                  <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> Agenda</span>
                  <ArrowRight size={14} />
                </LinkButton>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}
