/**
 * WhatsApp summary generators
 * Haal live data op uit de DB en format het als WhatsApp-vriendelijke tekst.
 */

import { query, queryOne } from '@/lib/db'

export async function buildDailySummary(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]
  const dayName = new Date().toLocaleDateString('nl-NL', { weekday: 'long' })

  const openTodos = await query<{ title: string; priority: string }>(`
    SELECT title, priority FROM todos WHERE completed = 0
    ORDER BY CASE priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
    LIMIT 5
  `)

  const overdueTodos = await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c FROM todos WHERE completed = 0 AND due_date::date < CURRENT_DATE
  `)

  const openInvoices = await queryOne<{ c: number; total: number }>(`
    SELECT COUNT(*) as c, SUM(amount) as total
    FROM finance_items WHERE type='factuur' AND status IN ('verstuurd','verlopen')
  `)

  const todayWorklog = await queryOne<{ total: number }>(`
    SELECT SUM(duration_minutes) as total FROM work_logs WHERE date = $1
  `, [today])

  const habitsToday = await query<{ name: string }>(`
    SELECT h.name FROM habits h
    WHERE h.active = 1 AND h.id NOT IN (
      SELECT habit_id FROM habit_logs WHERE logged_date = $1
    )
  `, [today])

  const lines: string[] = [
    `☀️ *Goedemorgen! ${dayName.charAt(0).toUpperCase() + dayName.slice(1)}soverzicht*`,
    '',
  ]

  // Todos
  if (openTodos.length > 0) {
    lines.push(`📋 *Open taken (top ${openTodos.length}):*`)
    openTodos.forEach(t => {
      const prio = t.priority === 'hoog' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'
      lines.push(`${prio} ${t.title}`)
    })
    if ((overdueTodos?.c ?? 0) > 0) lines.push(`⚠️ ${overdueTodos!.c} taken te laat`)
  } else {
    lines.push('✅ Geen open taken — lekker bezig!')
  }

  // Finance
  if ((openInvoices?.c ?? 0) > 0) {
    lines.push('')
    lines.push(`💸 *${openInvoices!.c} open facturen:* €${(openInvoices!.total || 0).toFixed(2)}`)
  }

  // Werklog vandaag
  if ((todayWorklog?.total ?? 0) > 0) {
    const h = Math.floor(todayWorklog!.total / 60)
    const m = todayWorklog!.total % 60
    lines.push('')
    lines.push(`⏱ Vandaag gelogd: ${h > 0 ? `${h}u ` : ''}${m > 0 ? `${m}m` : ''}`)
  }

  // Habits nog te doen
  if (habitsToday.length > 0) {
    lines.push('')
    lines.push(`🎯 *Gewoontes nog te doen:*`)
    habitsToday.slice(0, 4).forEach(h => lines.push(`• ${h.name}`))
  }

  lines.push('')
  lines.push('_Stuur een bericht om iets te doen. Ik luister!_')

  return lines.join('\n')
}

export async function buildWeeklySummary(): Promise<string> {
  const completedThisWeek = await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c FROM todos WHERE completed = 1 AND completed_at::date >= CURRENT_DATE - INTERVAL '7 days'
  `)

  const addedThisWeek = await queryOne<{ c: number }>(`
    SELECT COUNT(*) as c FROM todos WHERE created_at::date >= CURRENT_DATE - INTERVAL '7 days'
  `)

  const weekWork = await query<{ context: string; total: number }>(`
    SELECT context, SUM(duration_minutes) as total
    FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY context ORDER BY total DESC
  `)

  const weekIncome = await queryOne<{ total: number }>(`
    SELECT SUM(amount) as total FROM finance_items
    WHERE type='inkomst' AND created_at::date >= CURRENT_DATE - INTERVAL '7 days'
  `)

  const lines = [
    `📊 *Weekoverzicht — ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}*`,
    '',
    `✅ ${completedThisWeek?.c ?? 0} taken afgerond`,
    `➕ ${addedThisWeek?.c ?? 0} taken toegevoegd`,
  ]

  if (weekWork.length > 0) {
    lines.push('')
    lines.push('⏱ *Gewerkte tijd:*')
    weekWork.forEach(w => {
      const h = Math.floor(w.total / 60)
      const m = w.total % 60
      lines.push(`• ${w.context}: ${h > 0 ? `${h}u ` : ''}${m > 0 ? `${m}m` : ''}`)
    })
  }

  if ((weekIncome?.total ?? 0) > 0) {
    lines.push('')
    lines.push(`💰 Inkomsten deze week: €${weekIncome!.total.toFixed(2)}`)
  }

  return lines.join('\n')
}
