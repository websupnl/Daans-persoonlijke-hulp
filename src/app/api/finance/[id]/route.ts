import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'amount', 'contact_id', 'project_id', 'status', 'due_date', 'paid_date', 'category']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = $${i++}`)
      values.push(body[field] ?? null)
    }
  }

  // Als status betaald wordt, sla betaaldatum op
  if (body.status === 'betaald' && !body.paid_date) {
    updates.push(`paid_date = CURRENT_DATE`)
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE finance_items SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne(`
    SELECT f.*, c.name as contact_name FROM finance_items f
    LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.id = $1
  `, [id])
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute('DELETE FROM finance_items WHERE id = $1', [parseInt(params.id)])
  return NextResponse.json({ message: 'Item verwijderd' })
}
