export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function GET() {
  const balances = await query('SELECT * FROM finance_balances')
  return NextResponse.json({ data: balances })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { account, balance: newBalance } = body

    if (!account) {
      return NextResponse.json({ error: 'Account is verplicht' }, { status: 400 })
    }

    // 1. Get current calculated balance from transactions
    const stats = await queryOne<{ calculated: number }>(`
      SELECT
        SUM(CASE WHEN type IN ('inkomst', 'factuur') AND status = 'betaald' THEN amount WHEN type = 'uitgave' THEN -amount ELSE 0 END)::float as calculated
      FROM finance_items
      WHERE account = $1
    `, [account])

    const currentCalculated = stats?.calculated || 0
    const diff = Number(newBalance) - currentCalculated

    if (Math.abs(diff) > 0.009) {
      // 2. Create Kasverschil transaction
      await execute(`
        INSERT INTO finance_items (type, title, amount, account, category, status, description, needs_review, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      `, [
        diff > 0 ? 'inkomst' : 'uitgave',
        'Kasverschil',
        Math.abs(diff),
        account,
        'overig',
        'betaald',
        `Automatische correctie voor ${account} balans`,
        0
      ])
      
      await logActivity({
        entityType: 'finance',
        action: 'adjustment',
        title: `Kasverschil ${account}`,
        summary: `Balans aangepast naar €${Number(newBalance).toFixed(2)}. Correctie van €${diff.toFixed(2)} toegevoegd.`,
        metadata: { account, diff, newBalance }
      })
    }

    // 3. Update the finance_balances table
    await execute(`
      INSERT INTO finance_balances (account, balance, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (account) DO UPDATE SET balance = EXCLUDED.balance, updated_at = NOW()
    `, [account, newBalance])

    return NextResponse.json({ ok: true, diff })
  } catch (err) {
    console.error('[Finance Balances API] Error:', err)
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 })
  }
}
