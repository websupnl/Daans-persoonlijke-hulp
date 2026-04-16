import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const todoStats = await queryOne<{ total: number; open: number; due_today: number; overdue: number }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN completed = 0 AND due_date::date = CURRENT_DATE THEN 1 ELSE 0 END) as due_today,
      SUM(CASE WHEN completed = 0 AND due_date::date < CURRENT_DATE THEN 1 ELSE 0 END) as overdue
    FROM todos
  `)

  const noteStats = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM notes')
  const contactStats = await queryOne<{ total: number }>('SELECT COUNT(*) as total FROM contacts')

  const financeStats = await queryOne<{ open_amount: number; open_invoices: number; month_income: number; month_expenses: number }>(`
    SELECT
      SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as open_amount,
      COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_invoices,
      SUM(CASE WHEN type IN ('inkomst','factuur') AND status='betaald' AND TO_CHAR(COALESCE(paid_date, due_date, created_at::date), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') THEN amount ELSE 0 END) as month_income,
      SUM(CASE WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') THEN amount ELSE 0 END) as month_expenses
    FROM finance_items
  `)

  const habitStats = await queryOne<{ total: number; completed_today: number }>(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM habit_logs WHERE habit_id = habits.id AND logged_date = CURRENT_DATE) THEN 1 ELSE 0 END) as completed_today
    FROM habits WHERE active = 1
  `)

  // Recente todos (vandaag + overdue)
  const urgentTodos = await query(`
    SELECT t.*, p.color as project_color, p.title as project_title
    FROM todos t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.completed = 0 AND (
      t.due_date::date <= CURRENT_DATE + INTERVAL '1 day' OR t.priority = 'hoog'
    )
    ORDER BY CASE t.priority WHEN 'hoog' THEN 0 ELSE 1 END, t.due_date ASC
    LIMIT 8
  `)

  // Recente notes
  const recentNotes = await query(`
    SELECT id, title, updated_at FROM notes ORDER BY updated_at DESC LIMIT 5
  `)

  // Open facturen
  const openInvoices = await query(`
    SELECT f.id, f.title, f.amount, f.due_date, f.status, c.name as contact_name
    FROM finance_items f LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.type = 'factuur' AND f.status IN ('verstuurd','verlopen')
    ORDER BY f.due_date ASC LIMIT 5
  `)

  // Recente transacties (geen facturen)
  const recentFinance = await query(`
    SELECT f.*, c.name as contact_name
    FROM finance_items f
    LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.type != 'factuur'
    ORDER BY COALESCE(f.due_date, f.created_at::date) DESC, f.created_at DESC
    LIMIT 5
  `)

  const todayWork = await queryOne<{ total_minutes: number }>(`
    SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as total_minutes
    FROM work_logs
    WHERE date = CURRENT_DATE
  `)

  const inbox = await queryOne<{ total: number }>(`
    SELECT COUNT(*) as total FROM inbox_items WHERE parsed_status = 'pending'
  `)

  return NextResponse.json({
    stats: {
      todos: { total: todoStats?.total ?? 0, open: todoStats?.open ?? 0, dueToday: todoStats?.due_today ?? 0, overdue: todoStats?.overdue ?? 0 },
      notes: { total: noteStats?.total ?? 0 },
      contacts: { total: contactStats?.total ?? 0 },
      finance: {
        openInvoices: Number(financeStats?.open_invoices) || 0,
        openAmount: Number(financeStats?.open_amount) || 0,
        monthIncome: Number(financeStats?.month_income) || 0,
        monthExpenses: Number(financeStats?.month_expenses) || 0,
      },
      habits: { total: habitStats?.total ?? 0, completedToday: habitStats?.completed_today ?? 0 },
    },
    urgentTodos,
    recentNotes,
    openInvoices,
    recentFinance,
    todayWorkMinutes: todayWork?.total_minutes ?? 0,
    inboxCount: inbox?.total ?? 0,
  })
}
