import { NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET() {
  const db = getDb()

  const todoStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN completed = 0 AND date(due_date) = date('now') THEN 1 ELSE 0 END) as due_today,
      SUM(CASE WHEN completed = 0 AND date(due_date) < date('now') THEN 1 ELSE 0 END) as overdue
    FROM todos
  `).get() as { total: number; open: number; due_today: number; overdue: number }

  const noteStats = db.prepare('SELECT COUNT(*) as total FROM notes').get() as { total: number }
  const contactStats = db.prepare('SELECT COUNT(*) as total FROM contacts').get() as { total: number }

  const financeStats = db.prepare(`
    SELECT
      SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as open_amount,
      COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_invoices,
      SUM(CASE WHEN type IN ('inkomst','factuur') AND status='betaald' AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_income
    FROM finance_items
  `).get() as { open_amount: number; open_invoices: number; month_income: number }

  const habitStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM habit_logs WHERE habit_id = habits.id AND logged_date = date('now')) THEN 1 ELSE 0 END) as completed_today
    FROM habits WHERE active = 1
  `).get() as { total: number; completed_today: number }

  // Recente todos (vandaag + overdue)
  const urgentTodos = db.prepare(`
    SELECT t.*, p.color as project_color, p.title as project_title
    FROM todos t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.completed = 0 AND (
      date(t.due_date) <= date('now', '+1 days') OR t.priority = 'hoog'
    )
    ORDER BY CASE t.priority WHEN 'hoog' THEN 0 ELSE 1 END, t.due_date ASC
    LIMIT 8
  `).all()

  // Recente notes
  const recentNotes = db.prepare(`
    SELECT id, title, updated_at FROM notes ORDER BY updated_at DESC LIMIT 5
  `).all()

  // Open facturen
  const openInvoices = db.prepare(`
    SELECT f.id, f.title, f.amount, f.due_date, f.status, c.name as contact_name
    FROM finance_items f LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.type = 'factuur' AND f.status IN ('verstuurd','verlopen')
    ORDER BY f.due_date ASC LIMIT 5
  `).all()

  return NextResponse.json({
    stats: {
      todos: { total: todoStats.total, open: todoStats.open, dueToday: todoStats.due_today, overdue: todoStats.overdue },
      notes: { total: noteStats.total },
      contacts: { total: contactStats.total },
      finance: { openInvoices: financeStats.open_invoices, openAmount: financeStats.open_amount || 0, monthIncome: financeStats.month_income || 0 },
      habits: { total: habitStats.total, completedToday: habitStats.completed_today },
    },
    urgentTodos,
    recentNotes,
    openInvoices,
  })
}
