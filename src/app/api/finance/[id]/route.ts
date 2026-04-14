import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRow } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'amount', 'contact_id', 'project_id', 'status', 'due_date', 'paid_date', 'category']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      values.push(body[field] ?? null)
    }
  }

  if (body.status === 'betaald' && !body.paid_date) {
    updates.push("paid_date = date('now')")
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  await db.execute({ sql: `UPDATE finance_items SET ${updates.join(', ')} WHERE id = ?`, args: values })
  const updated = toRow(await db.execute({
    sql: `SELECT f.*, c.name as contact_name FROM finance_items f LEFT JOIN contacts c ON f.contact_id = c.id WHERE f.id = ?`,
    args: [id],
  }))
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM finance_items WHERE id = ?', args: [parseInt(params.id)] })
  return NextResponse.json({ message: 'Item verwijderd' })
}
