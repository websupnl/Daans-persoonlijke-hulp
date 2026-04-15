export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRow } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'date', 'time', 'duration', 'type', 'project_id', 'contact_id', 'all_day']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      values.push(body[field] ?? null)
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Geen velden' }, { status: 400 })
  updates.push("updated_at = datetime('now')")
  values.push(id)

  await db.execute({ sql: `UPDATE events SET ${updates.join(', ')} WHERE id = ?`, args: values })
  const updated = toRow(await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] }))
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [parseInt(params.id)] })
  return NextResponse.json({ message: 'Event verwijderd' })
}
