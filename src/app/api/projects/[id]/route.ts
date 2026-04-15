export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRow } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'status', 'color']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      values.push(body[field] ?? null)
    }
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  await db.execute({ sql: `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, args: values })
  const updated = toRow(await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [id] }))
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [parseInt(params.id)] })
  return NextResponse.json({ message: 'Project verwijderd' })
}
