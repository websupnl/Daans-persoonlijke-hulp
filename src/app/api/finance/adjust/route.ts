export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  const { account, actual_balance } = await req.json()

  if (!account || actual_balance === undefined) {
    return NextResponse.json({ error: 'Account en werkelijk saldo zijn verplicht' }, { status: 400 })
  }

  // 1. Bereken huidig saldo volgens systeem
  const currentRes = await queryOne<{ balance: number }>(`
    SELECT SUM(CASE WHEN type IN ('inkomst', 'factuur') AND status = 'betaald' THEN amount WHEN type = 'uitgave' THEN -amount ELSE 0 END)::float as balance
    FROM finance_items
    WHERE account = $1
  `, [account])

  const currentBalance = currentRes?.balance ?? 0
  const difference = actual_balance - currentBalance

  if (Math.abs(difference) < 0.01) {
    return NextResponse.json({ message: 'Geen verschil gevonden', difference: 0 })
  }

  // 2. Maak correctie transactie
  const type = difference > 0 ? 'inkomst' : 'uitgave'
  const amount = Math.abs(difference)
  const title = `Kasverschil correctie (${account})`

  const item = await queryOne(`
    INSERT INTO finance_items (type, title, amount, status, category, account, description)
    VALUES ($1, $2, $3, 'betaald', 'overig', $4, $5)
    RETURNING *
  `, [type, title, amount, account, `Handmatige saldo-aanpassing naar €${actual_balance}`])

  if (item && 'id' in item) {
    await logActivity({
      entityType: 'finance',
      entityId: Number(item.id),
      action: 'created',
      title,
      summary: `Kasverschil verwerkt voor ${account}: €${difference.toFixed(2)}`,
      metadata: { amount, type, account, actual_balance }
    })
  }

  return NextResponse.json({ data: item, difference })
}
