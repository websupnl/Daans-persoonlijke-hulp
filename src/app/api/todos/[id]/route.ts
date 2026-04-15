export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRow } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const existing = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [id] }))
  if (!existing) return NextResponse.json({ error: 'Todo niet gevonden' }, { status: 404 })

  const fields = ['title', 'description', 'category', 'priority', 'due_date', 'completed', 'project_id', 'contact_id', 'recurring']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      if (field === 'completed') {
        const isCompleted = body[field] ? 1 : 0
        values.push(isCompleted)
        updates.push('completed_at = ?')
        values.push(isCompleted ? new Date().toISOString() : null)
      } else {
        values.push(body[field] ?? null)
      }
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Geen velden om te updaten' }, { status: 400 })

  updates.push("updated_at = datetime('now')")
  values.push(id)

  await db.execute({ sql: `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`, args: values })
  const updated = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [id] }))
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const id = parseInt(params.id)
  const result = await db.execute({ sql: 'DELETE FROM todos WHERE id = ?', args: [id] })
  if (result.rowsAffected === 0) return NextResponse.json({ error: 'Todo niet gevonden' }, { status: 404 })
  return NextResponse.json({ message: 'Todo verwijderd' })
}
