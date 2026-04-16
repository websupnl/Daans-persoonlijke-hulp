export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/stats
 * Returns category breakdown and monthly income/expenses for charts.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const [categories, monthly] = await Promise.all([
    query<{ category: string; total: number; count: number }>(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM finance_items
      WHERE type = 'uitgave'
        AND (
          ($1::date IS NOT NULL AND $2::date IS NOT NULL AND COALESCE(due_date, created_at::date) BETWEEN $1 AND $2)
          OR ($1::date IS NULL AND TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM'))
        )
      GROUP BY category
      ORDER BY total DESC
      LIMIT 8
    `, [from || null, to || null]),
    query<{ month: string; income: number; expenses: number }>(`
      SELECT
        TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM') as month,
        SUM(CASE WHEN type = 'inkomst' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'uitgave' THEN amount ELSE 0 END) as expenses
      FROM finance_items
      WHERE COALESCE(due_date, created_at::date) >= (CURRENT_DATE - INTERVAL '6 months')::date
      GROUP BY TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM')
      ORDER BY month ASC
    `),
  ])

  return NextResponse.json({
    categories: categories.map(c => ({ ...c, total: Number(c.total) })),
    monthly: monthly.map(m => ({ ...m, income: Number(m.income), expenses: Number(m.expenses) })),
  })
}
