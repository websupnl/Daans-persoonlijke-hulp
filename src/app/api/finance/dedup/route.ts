export const dynamic = 'force-dynamic'

/**
 * GET  /api/finance/dedup  → preview: hoeveel dubbelen gevonden
 * POST /api/finance/dedup  → verwijder duplicaten (houdt oudste record per groep)
 *
 * Duplicaat = zelfde type + title + amount (afgerond op 2 decimalen) + due_date
 * Account wordt genegeerd zodat imports met/zonder account ook gededupliceerd worden.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'

export async function GET() {
  const dupes = await query<{
    type: string
    title: string
    amount: string
    due_date: string
    count: string
    ids: string
  }>(`
    SELECT
      type,
      title,
      ROUND(amount::numeric, 2)::text AS amount,
      COALESCE(due_date::text, 'geen datum') AS due_date,
      COUNT(*)::text AS count,
      STRING_AGG(id::text, ',' ORDER BY id) AS ids
    FROM finance_items
    WHERE type IN ('inkomst', 'uitgave')
    GROUP BY type, title, ROUND(amount::numeric, 2), due_date
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, due_date DESC
    LIMIT 100
  `)

  const totalDupes = dupes.reduce((sum, r) => sum + (parseInt(r.count) - 1), 0)
  const totalAmount = dupes.reduce((sum, r) => {
    return sum + (parseInt(r.count) - 1) * parseFloat(r.amount)
  }, 0)

  return NextResponse.json({
    duplicate_groups: dupes.length,
    records_to_delete: totalDupes,
    inflated_amount: Math.round(totalAmount * 100) / 100,
    preview: dupes.slice(0, 20).map(r => ({
      type: r.type,
      title: r.title.slice(0, 50),
      amount: parseFloat(r.amount),
      due_date: r.due_date,
      count: parseInt(r.count),
      ids: r.ids.split(',').map(Number),
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const confirm = body?.confirm === true

  if (!confirm) {
    return NextResponse.json(
      { error: 'Stuur { confirm: true } in de body om door te gaan.' },
      { status: 400 }
    )
  }

  // Count before
  const before = await queryOne<{ c: string }>('SELECT COUNT(*)::text AS c FROM finance_items')
  const beforeCount = parseInt(before?.c ?? '0')

  // Delete duplicates — keep lowest id (oldest record) per group
  await execute(`
    DELETE FROM finance_items
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY type, title, ROUND(amount::numeric, 2), due_date
                 ORDER BY id ASC
               ) AS rn
        FROM finance_items
        WHERE type IN ('inkomst', 'uitgave')
      ) ranked
      WHERE rn > 1
    )
  `)

  const after = await queryOne<{ c: string }>('SELECT COUNT(*)::text AS c FROM finance_items')
  const afterCount = parseInt(after?.c ?? '0')
  const deleted = beforeCount - afterCount

  return NextResponse.json({
    ok: true,
    deleted,
    before: beforeCount,
    after: afterCount,
    message: `${deleted} dubbele transacties verwijderd. Van ${beforeCount} naar ${afterCount} records.`,
  })
}
