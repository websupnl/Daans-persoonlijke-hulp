/**
 * Life Snapshot — Compressed Metadata Builder
 *
 * Builds a ~500-token summary of Daan's entire life state.
 * Used by the Proactive Engine (Tier 1 Sentry) to detect anomalies
 * without blowing the token budget on raw data.
 */

import { query, queryOne } from '../db'
import { analyzeFinance, getFinanceRules, type FinanceAnomaly, type FinanceRow } from '../finance/engine'

export interface LifeSnapshot {
  // Meta
  generatedAt: string
  hourOfDay: number
  dayOfWeek: number // 0=Sun … 6=Sat
  daysSinceLastInteraction: number

  // Todos
  openTodosCount: number
  overdueTodosCount: number
  highPriorityOpen: number
  oldestOverdueDays: number | null
  staleTodos: Array<{ id: number; title: string; daysSinceCreated: number; priority: string }>

  // Finances
  openInvoicesCount: number
  openInvoicesTotal: number
  daysSinceLastFinanceEntry: number
  monthIncomeTotal: number
  monthExpenseTotal: number
  detailedAnomalies: FinanceAnomaly[]

  // Journal
  daysSinceLastJournal: number
  lastSevenMoods: Array<number | null>
  lastSevenEnergies: Array<number | null>
  avgMood7Days: number | null
  journalKeywords: string[]

  // Habits
  habitCompletionRate7Days: number // 0-1
  missedHabitsConsecutive: number  // max consecutive misses across any habit
  habitDetails: Array<{ name: string; missedDays: number }>

  // Inbox
  pendingInboxCount: number
  oldestPendingInboxHours: number | null

  // Work
  totalWorkMinutesToday: number
  workContextsToday: string[]
  avgWorkMinutes7Days: number

  // AI Theories (top 3 most recent)
  topTheories: Array<{ category: string; theory: string; confidence: number }>

  // Anomaly flags (pre-computed by JS)
  anomalies: AnomalyFlag[]
}

export interface AnomalyFlag {
  type: AnomalyType
  severity: 'low' | 'medium' | 'high'
  detail: string
  nudgeTopic: string // unique key for nudge_state dedup
}

export type AnomalyType =
  | 'finance_silence'
  | 'journal_silence'
  | 'overdue_spike'
  | 'habit_streak_break'
  | 'inbox_overflow'
  | 'user_silence'
  | 'mood_decline'
  | 'workload_overload'
  | 'stale_todo'
  | 'open_invoices_aging'

export async function buildLifeSnapshot(): Promise<LifeSnapshot> {
  const now = new Date()
  const hourOfDay = parseInt(now.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hour12: false }), 10)
  const dayOfWeek = now.getDay()

  const [
    todoCounts,
    staleTodosRaw,
    financeStats,
    lastFinanceEntry,
    journalStats,
    habitStats,
    inboxStats,
    workStats,
    lastInteraction,
    topTheoriesRaw,
    financeAnalysis,
  ] = await Promise.all([
    // Todo counts
    query<{ open: string; overdue: string; high_priority: string; oldest_overdue_days: string | null }>(`
      SELECT
        COUNT(*) FILTER (WHERE completed = 0) as open,
        COUNT(*) FILTER (WHERE completed = 0 AND due_date IS NOT NULL AND due_date < CURRENT_DATE) as overdue,
        COUNT(*) FILTER (WHERE completed = 0 AND priority = 'hoog') as high_priority,
        MAX(CURRENT_DATE - due_date) FILTER (WHERE completed = 0 AND due_date IS NOT NULL AND due_date < CURRENT_DATE) as oldest_overdue_days
      FROM todos
    `),

    // Stale todos (open, created >14 days ago, high/medium priority)
    query<{ id: number; title: string; days_since_created: number; priority: string }>(`
      SELECT id, title,
             (CURRENT_DATE - created_at::date)::int as days_since_created,
             priority
      FROM todos
      WHERE completed = 0
        AND created_at < NOW() - INTERVAL '14 days'
        AND priority IN ('hoog','medium')
      ORDER BY days_since_created DESC
      LIMIT 5
    `),

    // Finance stats this month
    query<{ type: string; total: string; count: string }>(`
      SELECT type, SUM(amount) as total, COUNT(*) as count
      FROM finance_items
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY type
    `),

    // Last finance entry
    queryOne<{ days_ago: number; open_invoices: string; open_total: string }>(`
      SELECT
        (CURRENT_DATE - MAX(created_at)::date)::int as days_ago,
        COUNT(*) FILTER (WHERE type='factuur' AND status IN ('verstuurd','concept')) as open_invoices,
        COALESCE(SUM(amount) FILTER (WHERE type='factuur' AND status IN ('verstuurd','concept')), 0) as open_total
      FROM finance_items
    `),

    // Journal: last 7 days
    query<{ date: string; mood: number | null; energy: number | null; content: string }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, mood, energy, LEFT(content, 300) as content
      FROM journal_entries
      ORDER BY date DESC
      LIMIT 7
    `),

    // Habit completion rate last 7 days
    query<{ name: string; total_days: number; logged_days: number }>(`
      SELECT h.name,
             7 as total_days,
             COUNT(hl.id)::int as logged_days
      FROM habits h
      LEFT JOIN habit_logs hl ON hl.habit_id = h.id
        AND hl.logged_date >= CURRENT_DATE - INTERVAL '6 days'
      WHERE h.active = 1
      GROUP BY h.id, h.name
    `),

    // Inbox stats
    queryOne<{ pending_count: string; oldest_hours: string | null }>(`
      SELECT COUNT(*) as pending_count,
             EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/3600 as oldest_hours
      FROM inbox_items
      WHERE parsed_status = 'pending'
    `),

    // Work stats
    query<{ total_today: string; contexts_today: string; avg_7days: string }>(`
      SELECT
        COALESCE(SUM(CASE WHEN date = CURRENT_DATE THEN COALESCE(actual_duration_minutes, duration_minutes) ELSE 0 END), 0) as total_today,
        STRING_AGG(DISTINCT CASE WHEN date = CURRENT_DATE THEN context END, ',') as contexts_today,
        COALESCE(AVG(daily_total), 0) as avg_7days
      FROM work_logs,
        LATERAL (
          SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as daily_total
          FROM work_logs wl2
          WHERE wl2.date = work_logs.date
            AND wl2.date >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY wl2.date
        ) sub
      WHERE date >= CURRENT_DATE - INTERVAL '6 days'
    `).catch(() => []),

    // Last interaction
    queryOne<{ hours_ago: number }>(`
      SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/3600 as hours_ago
      FROM chat_messages
      WHERE role = 'user'
    `),

    // AI theories
    query<{ category: string; theory: string; confidence: number }>(`
      SELECT category, theory, confidence
      FROM ai_theories
      ORDER BY last_updated DESC
      LIMIT 3
    `).catch(() => []),

    // Finance analysis for detailed anomalies
    (async () => {
      try {
        const rows = await query<FinanceRow>(`
          SELECT * FROM finance_items 
          WHERE created_at >= NOW() - INTERVAL '60 days'
          ORDER BY created_at DESC
        `)
        const rules = await getFinanceRules()
        return analyzeFinance(rows, rules)
      } catch (err) {
        console.error('[buildLifeSnapshot] Finance analysis error:', err)
        return null
      }
    })(),
  ])

  // Process todo data
  const todoRow = todoCounts[0] ?? {}
  const openTodosCount = parseInt(String(todoRow.open ?? '0'), 10)
  const overdueTodosCount = parseInt(String(todoRow.overdue ?? '0'), 10)
  const highPriorityOpen = parseInt(String(todoRow.high_priority ?? '0'), 10)
  const oldestOverdueDays = todoRow.oldest_overdue_days ? parseInt(String(todoRow.oldest_overdue_days), 10) : null

  const staleTodos = staleTodosRaw.map(t => ({
    id: t.id,
    title: t.title,
    daysSinceCreated: t.days_since_created,
    priority: t.priority,
  }))

  // Process finance data
  const finRow = lastFinanceEntry as { days_ago?: number; open_invoices?: string; open_total?: string } | undefined
  const daysSinceLastFinanceEntry = finRow?.days_ago != null ? finRow.days_ago : 999
  const openInvoicesCount = parseInt(String(finRow?.open_invoices ?? '0'), 10)
  const openInvoicesTotal = parseFloat(String(finRow?.open_total ?? '0'))

  let monthIncomeTotal = 0
  let monthExpenseTotal = 0
  for (const row of financeStats) {
    if (row.type === 'inkomst') monthIncomeTotal = parseFloat(String(row.total ?? '0'))
    if (row.type === 'uitgave') monthExpenseTotal = parseFloat(String(row.total ?? '0'))
  }

  // Process journal data
  const daysSinceLastJournal = journalStats.length > 0
    ? Math.round((now.getTime() - new Date(journalStats[0].date).getTime()) / 86400000)
    : 999

  const lastSevenMoods = journalStats.map(j => j.mood ?? null)
  const lastSevenEnergies = journalStats.map(j => j.energy ?? null)
  const validMoods = lastSevenMoods.filter(m => m !== null) as number[]
  const avgMood7Days = validMoods.length > 0
    ? Math.round((validMoods.reduce((a, b) => a + b, 0) / validMoods.length) * 10) / 10
    : null

  // Simple keyword extraction from journal content
  const journalText = journalStats.map(j => j.content).join(' ').toLowerCase()
  const keywordCandidates = ['stress', 'moe', 'druk', 'goed', 'energie', 'twijfel', 'focus', 'blij', 'bouma', 'websup', 'geld', 'project', 'sita']
  const journalKeywords = keywordCandidates.filter(k => journalText.includes(k))

  // Process habit data
  const totalHabitDays = habitStats.reduce((s, h) => s + h.total_days, 0)
  const totalLogged = habitStats.reduce((s, h) => s + (h.logged_days ?? 0), 0)
  const habitCompletionRate7Days = totalHabitDays > 0 ? totalLogged / totalHabitDays : 1

  const habitDetails = habitStats.map(h => ({
    name: h.name,
    missedDays: h.total_days - (h.logged_days ?? 0),
  }))
  const missedHabitsConsecutive = habitDetails.length > 0
    ? Math.max(...habitDetails.map(h => h.missedDays))
    : 0

  // Process inbox data
  const inboxRow = inboxStats as { pending_count?: string; oldest_hours?: string | null } | undefined
  const pendingInboxCount = parseInt(String(inboxRow?.pending_count ?? '0'), 10)
  const oldestPendingInboxHours = inboxRow?.oldest_hours ? parseFloat(String(inboxRow.oldest_hours)) : null

  // Process work data
  const workRow = (workStats as Array<{ total_today: string; contexts_today: string | null; avg_7days: string }>)[0] ?? {}
  const totalWorkMinutesToday = parseInt(String(workRow.total_today ?? '0'), 10)
  const workContextsToday = workRow.contexts_today
    ? workRow.contexts_today.split(',').filter(Boolean)
    : []
  const avgWorkMinutes7Days = parseFloat(String(workRow.avg_7days ?? '0'))

  // Last interaction
  const daysSinceLastInteraction = lastInteraction?.hours_ago != null
    ? lastInteraction.hours_ago / 24
    : 999

  // Detect anomalies (pure JS — no LLM)
  const anomalies: AnomalyFlag[] = detectAnomalies({
    hourOfDay,
    daysSinceLastInteraction,
    overdueTodosCount,
    highPriorityOpen,
    oldestOverdueDays,
    staleTodos,
    daysSinceLastFinanceEntry,
    openInvoicesCount,
    openInvoicesTotal,
    daysSinceLastJournal,
    avgMood7Days,
    lastSevenMoods,
    habitCompletionRate7Days,
    missedHabitsConsecutive,
    pendingInboxCount,
    oldestPendingInboxHours,
    totalWorkMinutesToday,
  })

  return {
    generatedAt: now.toISOString(),
    hourOfDay,
    dayOfWeek,
    daysSinceLastInteraction,
    openTodosCount,
    overdueTodosCount,
    highPriorityOpen,
    oldestOverdueDays,
    staleTodos,
    openInvoicesCount,
    openInvoicesTotal,
    daysSinceLastFinanceEntry,
    monthIncomeTotal,
    monthExpenseTotal,
    detailedAnomalies: financeAnalysis?.anomalies ?? [],
    daysSinceLastJournal,
    lastSevenMoods,
    lastSevenEnergies,
    avgMood7Days,
    journalKeywords,
    habitCompletionRate7Days,
    missedHabitsConsecutive,
    habitDetails,
    pendingInboxCount,
    oldestPendingInboxHours,
    totalWorkMinutesToday,
    workContextsToday,
    avgWorkMinutes7Days: Math.round(avgWorkMinutes7Days),
    topTheories: topTheoriesRaw as Array<{ category: string; theory: string; confidence: number }>,
    anomalies,
  }
}

interface AnomalyInput {
  hourOfDay: number
  daysSinceLastInteraction: number
  overdueTodosCount: number
  highPriorityOpen: number
  oldestOverdueDays: number | null
  staleTodos: Array<{ id: number; title: string; daysSinceCreated: number; priority: string }>
  daysSinceLastFinanceEntry: number
  openInvoicesCount: number
  openInvoicesTotal: number
  daysSinceLastJournal: number
  avgMood7Days: number | null
  lastSevenMoods: Array<number | null>
  habitCompletionRate7Days: number
  missedHabitsConsecutive: number
  pendingInboxCount: number
  oldestPendingInboxHours: number | null
  totalWorkMinutesToday: number
}

function detectAnomalies(s: AnomalyInput): AnomalyFlag[] {
  const flags: AnomalyFlag[] = []

  // No nudges between 23:00 and 08:00
  if (s.hourOfDay >= 23 || s.hourOfDay < 8) return []

  if (s.daysSinceLastFinanceEntry > 7) {
    flags.push({
      type: 'finance_silence',
      severity: s.daysSinceLastFinanceEntry > 14 ? 'high' : 'medium',
      detail: `Geen financiële invoer in ${Math.round(s.daysSinceLastFinanceEntry)} dagen`,
      nudgeTopic: 'finance_silence',
    })
  }

  if (s.openInvoicesCount >= 1) {
    flags.push({
      type: 'open_invoices_aging',
      severity: 'medium',
      detail: `${s.openInvoicesCount} openstaande facturen (totaal: €${Math.round(s.openInvoicesTotal)})`,
      nudgeTopic: 'open_invoices',
    })
  }

  if (s.daysSinceLastJournal > 3) {
    flags.push({
      type: 'journal_silence',
      severity: s.daysSinceLastJournal > 7 ? 'high' : 'medium',
      detail: `Geen dagboekEntry in ${s.daysSinceLastJournal} dagen`,
      nudgeTopic: 'journal_silence',
    })
  }

  if (s.overdueTodosCount >= 3) {
    flags.push({
      type: 'overdue_spike',
      severity: s.overdueTodosCount >= 10 ? 'high' : 'medium',
      detail: `${s.overdueTodosCount} achterstallige taken${s.oldestOverdueDays ? `, oudste: ${s.oldestOverdueDays} dagen` : ''}`,
      nudgeTopic: 'overdue_todos',
    })
  }

  if (s.staleTodos.length >= 2) {
    flags.push({
      type: 'stale_todo',
      severity: 'low',
      detail: `${s.staleTodos.length} taken onaangeroerd voor >14 dagen`,
      nudgeTopic: 'stale_todos',
    })
  }

  if (s.habitCompletionRate7Days < 0.5 || s.missedHabitsConsecutive >= 3) {
    flags.push({
      type: 'habit_streak_break',
      severity: s.missedHabitsConsecutive >= 5 ? 'high' : 'medium',
      detail: `Gewoontecompletie: ${Math.round(s.habitCompletionRate7Days * 100)}% (${s.missedHabitsConsecutive} opeenvolgende missers)`,
      nudgeTopic: 'habit_streak',
    })
  }

  if (s.pendingInboxCount >= 3 && s.oldestPendingInboxHours && s.oldestPendingInboxHours > 24) {
    flags.push({
      type: 'inbox_overflow',
      severity: 'medium',
      detail: `${s.pendingInboxCount} onverwerkte inbox-items, oudste: ${Math.round(s.oldestPendingInboxHours)}u geleden`,
      nudgeTopic: 'inbox_overflow',
    })
  }

  if (s.daysSinceLastInteraction * 24 >= 12) {
    flags.push({
      type: 'user_silence',
      severity: 'low',
      detail: `Geen interactie in ${Math.round(s.daysSinceLastInteraction * 24)}u`,
      nudgeTopic: 'user_silence',
    })
  }

  if (s.avgMood7Days !== null && s.avgMood7Days < 2.5) {
    const recent = s.lastSevenMoods.slice(0, 3).filter(m => m !== null) as number[]
    if (recent.length >= 2 && recent.every(m => m <= 2)) {
      flags.push({
        type: 'mood_decline',
        severity: 'high',
        detail: `Stemming opeenvolgend laag (gem. ${s.avgMood7Days}/5 over 7 dagen)`,
        nudgeTopic: 'mood_decline',
      })
    }
  }

  if (s.totalWorkMinutesToday >= 480) {
    flags.push({
      type: 'workload_overload',
      severity: 'medium',
      detail: `${Math.round(s.totalWorkMinutesToday / 60 * 10) / 10}u gewerkt vandaag`,
      nudgeTopic: 'workload_today',
    })
  }

  return flags
}

/**
 * Format snapshot as a compact prompt section (~400 tokens max).
 */
export function formatSnapshotForPrompt(snap: LifeSnapshot): string {
  const lines: string[] = [
    `=== LIFE SNAPSHOT (${snap.generatedAt.slice(0, 16)}) ===`,
    `Taken: ${snap.openTodosCount} open, ${snap.overdueTodosCount} achterstallig, ${snap.highPriorityOpen} hoog-prio`,
    `Financiën: €${Math.round(snap.monthIncomeTotal)} inkomsten / €${Math.round(snap.monthExpenseTotal)} uitgaven deze maand | ${snap.openInvoicesCount} facturen open (€${Math.round(snap.openInvoicesTotal)}) | laatste invoer: ${snap.daysSinceLastFinanceEntry}d geleden`,
    `Dagboek: laatste entry ${snap.daysSinceLastJournal}d geleden | gem. stemming 7d: ${snap.avgMood7Days ?? 'onbekend'}/5 | keywords: ${snap.journalKeywords.slice(0, 5).join(', ') || 'geen'}`,
    `Gewoontes: ${Math.round(snap.habitCompletionRate7Days * 100)}% completie 7d | max achtereenvolgende missers: ${snap.missedHabitsConsecutive}`,
    `Inbox: ${snap.pendingInboxCount} onverwerkt`,
    `Werk vandaag: ${Math.round(snap.totalWorkMinutesToday / 60 * 10) / 10}u (${snap.workContextsToday.join(', ') || 'geen'})`,
    `Laatste interactie: ${Math.round(snap.daysSinceLastInteraction * 24)}u geleden`,
  ]

  if (snap.detailedAnomalies.length > 0) {
    lines.push(`Financiële uitschieters:`)
    snap.detailedAnomalies.forEach(a => lines.push(`  - ${a.date}: ${a.title} €${a.amount} (${a.reason})`))
  }

  if (snap.topTheories.length > 0) {
    lines.push(`AI-theorieën:`)
    snap.topTheories.forEach(t => lines.push(`  [${t.category}] ${t.theory} (conf: ${t.confidence})`))
  }

  if (snap.anomalies.length > 0) {
    lines.push(`Gedetecteerde anomalieën:`)
    snap.anomalies.forEach(a => lines.push(`  ⚠ [${a.severity}] ${a.detail}`))
  }

  return lines.join('\n')
}
