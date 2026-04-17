export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { rows, account = 'privé' } = await req.json()

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Geen transacties ontvangen' }, { status: 400 })
    }

    let imported = 0
    for (const row of rows) {
      try {
        const affected = await execute(`
          INSERT INTO finance_items (
            type,
            title,
            amount,
            category,
            subcategory,
            merchant_raw,
            merchant_normalized,
            category_confidence,
            personal_business,
            needs_review,
            account,
            status,
            due_date,
            created_at
          )
          SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'betaald', $12, NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM finance_items
            WHERE type = $1
              AND title = $2
              AND ROUND(amount::numeric, 2) = ROUND($3::numeric, 2)
              AND due_date = $12::date
              AND account = $11
          )
        `, [
          row.type,
          row.description,
          row.amount,
          row.category,
          row.subcategory,
          row.merchant_raw,
          row.merchant_normalized,
          row.category_confidence,
          account,
          row.category_confidence < 0.65 ? 1 : 0,
          account,
          row.date,
        ])
        if (affected > 0) imported++
      } catch (err) {
        console.error('Error importing row:', err)
      }
    }

    return NextResponse.json({ imported, total: rows.length })
  } catch (error: any) {
    console.error('Save Import Error:', error)
    return NextResponse.json({ error: error.message || 'Interne serverfout' }, { status: 500 })
  }
}
