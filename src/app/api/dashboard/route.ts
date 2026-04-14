import { NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET() {
  const db = await getDb()

  const todoStatsRow = toRow(await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN completed = 0 AND date(due_date) = date('now') THEN 1 ELSE 0 END) as due_today,
      SUM(CASE WHEN completed = 0 AND date(due_date) < date('now') THEN 1 ELSE 0 END) as overdue
    FROM todos
  `))

  const noteStatsRow = toRow(await db.execute('SELECT COUNT(*) as total FROM notes'))
  const contactStatsRow = toRow(await db.execute('SELECT COUNT(*) as total FROM contacts'))

  const financeStatsRow = toRow(await db.execute(`
    SELECT
      SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as open_amount,
      COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_invoices,
      SUM(CASE WHEN type IN ('inkomst','factuur') AND status='betaald' AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_income
    FROM finance_items
  `))

  const habitStatsRow = toRow(await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM habit_logs WHERE habit_id = habits.id AND logged_date = date('now')) THEN 1 ELSE 0 END) as completed_today
    FROM habits WHERE active = 1
  `))

  const urgentTodos = toRows(await db.execute(`
    SELECT t.*, p.color as project_color, p.title as project_title
    FROM todos t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.completed = 0 AND (
      date(t.due_date) <= date('now', '+1 days') OR t.priority = 'hoog'
    )
    ORDER BY CASE t.priority WHEN 'hoog' THEN 0 ELSE 1 END, t.due_date ASC
    LIMIT 8
  `))

  const recentNotes = toRows(await db.execute(`SELECT id, title, updated_at FROM notes ORDER BY updated_at DESC LIMIT 5`))

  const openInvoices = toRows(await db.execute(`
    SELECT f.id, f.title, f.amount, f.due_date, f.status, c.name as contact_name
    FROM finance_items f LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.type = 'factuur' AND f.status IN ('verstuurd','verlopen')
    ORDER BY f.due_date ASC LIMIT 5
  `))

  return NextResponse.json({
    stats: {
      todos: {
        total: (todoStatsRow?.total as number) ?? 0,
        open: (todoStatsRow?.open as number) ?? 0,
        dueToday: (todoStatsRow?.due_today as number) ?? 0,
        overdue: (todoStatsRow?.overdue as number) ?? 0,
      },
      notes: { total: (noteStatsRow?.total as number) ?? 0 },
      contacts: { total: (contactStatsRow?.total as number) ?? 0 },
      finance: {
        openInvoices: (financeStatsRow?.open_invoices as number) ?? 0,
        openAmount: (financeStatsRow?.open_amount as number) ?? 0,
        monthIncome: (financeStatsRow?.month_income as number) ?? 0,
      },
      habits: {
        total: (habitStatsRow?.total as number) ?? 0,
        completedToday: (habitStatsRow?.completed_today as number) ?? 0,
      },
    },
    urgentTodos,
    recentNotes,
    openInvoices,
  })
}
