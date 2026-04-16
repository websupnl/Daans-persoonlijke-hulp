export const dynamic = 'force-dynamic'

/**
 * GET /api/finance/stats
 * Returns category breakdown and monthly income/expenses for charts.
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  const [categories, monthly] = await Promise.all([
    query<{ category: string; total: number; count: number }>(`
      WITH active AS (
        SELECT COALESCE(
          TO_CHAR(MAX(COALESCE(due_date, created_at::date)), 'YYYY-MM'),
          TO_CHAR(NOW(), 'YYYY-MM')
        ) as month FROM finance_items
      )
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM finance_items
      WHERE type = 'uitgave'
        AND TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM') = (SELECT month FROM active)
      GROUP BY category
      ORDER BY total DESC
      LIMIT 8
    `),
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

  return NextResponse.json({ categories, monthly })
}
