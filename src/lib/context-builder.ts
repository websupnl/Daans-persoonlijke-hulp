/**
 * Bouwt een rijke tekstuele context op uit alle gebruikersdata.
 * Wordt gebruikt als context voor AI-antwoorden en slimme regel-gebaseerde responses.
 */

import { type Client } from '@libsql/client'
import { toRows, toRow } from '@/lib/db'
import { format, subDays } from 'date-fns'
import { nl } from 'date-fns/locale'

export interface HabitWithStatus {
  id: number
  name: string
  icon: string
  streak: number
  completedToday: boolean
  frequency: string
}

export interface UserContext {
  habits: HabitWithStatus[]
  openTodos: Array<{ title: string; priority: string; due_date?: string; category: string }>
  overdueTodos: number
  highPriorityTodos: number
  finance: { openAmount: number; openCount: number; monthIncome: number; monthExpenses: number; overdueCount: number }
  journal: { mood?: number; energy?: number; highlights?: string } | null
  recentNotes: string[]
  memories: string[]
  contactCount: number
  todayHabitsCompleted: number
  todayHabitsTotal: number
}

export async function getUserContext(db: Client): Promise<UserContext> {
  const today = format(new Date(), 'yyyy-MM-dd')

  const [habitsRaw, todosRaw, financeRow, journalRow, notesRaw, memoriesRaw, contactRow] = await Promise.all([
    toRows(await db.execute('SELECT * FROM habits WHERE active = 1 ORDER BY created_at')),
    toRows(await db.execute(`
      SELECT title, priority, due_date, category FROM todos
      WHERE completed = 0
      ORDER BY CASE priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, due_date ASC
      LIMIT 20
    `)),
    toRow(await db.execute(`
      SELECT
        SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as open_amount,
        COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_count,
        COUNT(CASE WHEN type='factuur' AND status='verlopen' THEN 1 END) as overdue_count,
        SUM(CASE WHEN status='betaald' AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_income,
        SUM(CASE WHEN type='uitgave' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_expenses
      FROM finance_items
    `)),
    toRow(await db.execute({ sql: 'SELECT mood, energy, highlights FROM journal_entries WHERE date = ?', args: [today] })),
    toRows(await db.execute('SELECT title FROM notes ORDER BY updated_at DESC LIMIT 8')),
    toRows(await db.execute('SELECT value FROM memories ORDER BY updated_at DESC LIMIT 25')),
    toRow(await db.execute('SELECT COUNT(*) as c FROM contacts')),
  ])

  // Bereken streaks en vandaag-status per gewoonte
  const habits: HabitWithStatus[] = await Promise.all(habitsRaw.map(async (h) => {
    const logs = toRows(await db.execute({
      sql: 'SELECT logged_date FROM habit_logs WHERE habit_id = ? ORDER BY logged_date DESC LIMIT 90',
      args: [h.id as number],
    }))

    const logSet = new Set(logs.map(l => l.logged_date as string))
    const completedToday = logSet.has(today)

    // Bereken streak
    let streak = 0
    const d = new Date(today)
    while (logSet.has(format(d, 'yyyy-MM-dd'))) {
      streak++
      d.setDate(d.getDate() - 1)
    }

    return {
      id: h.id as number,
      name: h.name as string,
      icon: (h.icon as string) || '●',
      streak,
      completedToday,
      frequency: (h.frequency as string) || 'dagelijks',
    }
  }))

  const openTodos = todosRaw.map(t => ({
    title: t.title as string,
    priority: t.priority as string,
    due_date: t.due_date as string | undefined,
    category: t.category as string,
  }))

  const today2 = format(new Date(), 'yyyy-MM-dd')
  const overdueTodos = openTodos.filter(t => t.due_date && t.due_date < today2).length
  const highPriorityTodos = openTodos.filter(t => t.priority === 'hoog').length

  return {
    habits,
    openTodos,
    overdueTodos,
    highPriorityTodos,
    finance: {
      openAmount: (financeRow?.open_amount as number) ?? 0,
      openCount: (financeRow?.open_count as number) ?? 0,
      monthIncome: (financeRow?.month_income as number) ?? 0,
      monthExpenses: (financeRow?.month_expenses as number) ?? 0,
      overdueCount: (financeRow?.overdue_count as number) ?? 0,
    },
    journal: journalRow ? {
      mood: journalRow.mood as number | undefined,
      energy: journalRow.energy as number | undefined,
      highlights: journalRow.highlights as string | undefined,
    } : null,
    recentNotes: notesRaw.map(n => n.title as string),
    memories: memoriesRaw.map(m => m.value as string),
    contactCount: (contactRow?.c as number) ?? 0,
    todayHabitsCompleted: habits.filter(h => h.completedToday).length,
    todayHabitsTotal: habits.length,
  }
}

/** Formatteert de context als tekst voor gebruik in een AI-prompt */
export function contextToPrompt(ctx: UserContext): string {
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: nl })
  const lines: string[] = [`Vandaag: ${today}`, '']

  // Gewoontes
  lines.push('GEWOONTES:')
  if (ctx.habits.length === 0) {
    lines.push('Geen gewoontes ingesteld.')
  } else {
    ctx.habits.forEach(h => {
      const streakStr = h.streak > 0 ? `${h.streak} dag${h.streak !== 1 ? 'en' : ''} streak${h.streak >= 7 ? ' 🔥' : ''}` : 'geen streak'
      lines.push(`- ${h.icon} ${h.name}: ${streakStr}, vandaag: ${h.completedToday ? '✓ gedaan' : '✗ nog te doen'}`)
    })
  }

  // Todos
  lines.push('', 'OPEN TAKEN:')
  if (ctx.openTodos.length === 0) {
    lines.push('Geen open taken.')
  } else {
    ctx.openTodos.slice(0, 15).forEach(t => {
      const priority = t.priority === 'hoog' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'
      const due = t.due_date ? ` (vervalt: ${t.due_date})` : ''
      const late = t.due_date && t.due_date < format(new Date(), 'yyyy-MM-dd') ? ' ⚠️ TE LAAT' : ''
      lines.push(`- ${priority} ${t.title}${due}${late}`)
    })
    if (ctx.openTodos.length > 15) lines.push(`  ... en ${ctx.openTodos.length - 15} meer`)
  }

  // Financiën
  lines.push('', 'FINANCIËN:')
  lines.push(`- Open facturen: ${ctx.finance.openCount} stuks, totaal €${ctx.finance.openAmount.toFixed(2)}`)
  if (ctx.finance.overdueCount > 0) lines.push(`- ⚠️ VERLOPEN facturen: ${ctx.finance.overdueCount} stuks — actie vereist!`)
  lines.push(`- Inkomsten deze maand: €${ctx.finance.monthIncome.toFixed(2)}`)
  lines.push(`- Uitgaven deze maand: €${ctx.finance.monthExpenses.toFixed(2)}`)

  // Dagboek
  lines.push('', 'DAGBOEK VANDAAG:')
  if (ctx.journal) {
    if (ctx.journal.mood) lines.push(`- Stemming: ${ctx.journal.mood}/5 ${'⭐'.repeat(ctx.journal.mood)}`)
    if (ctx.journal.energy) lines.push(`- Energie: ${ctx.journal.energy}/5 ${'⚡'.repeat(ctx.journal.energy)}`)
    if (ctx.journal.highlights) lines.push(`- Hoogtepunten: ${ctx.journal.highlights}`)
  } else {
    lines.push('Nog geen dagboek entry vandaag.')
  }

  // Notes
  lines.push('', 'RECENTE NOTES:')
  if (ctx.recentNotes.length > 0) {
    ctx.recentNotes.forEach(t => lines.push(`- ${t}`))
  } else {
    lines.push('Geen notes.')
  }

  // Contacten
  lines.push('', `CONTACTEN: ${ctx.contactCount} opgeslagen`)

  // Geheugen
  if (ctx.memories.length > 0) {
    lines.push('', 'WAT IK OVER DAAN WEET:')
    ctx.memories.forEach(m => lines.push(`- ${m}`))
  }

  return lines.join('\n')
}
