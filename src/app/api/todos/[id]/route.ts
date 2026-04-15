export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()

  const existing = await queryOne('SELECT * FROM todos WHERE id = $1', [id])
  if (!existing) return NextResponse.json({ error: 'Todo niet gevonden' }, { status: 404 })

  const fields = ['title', 'description', 'category', 'priority', 'due_date', 'completed', 'project_id', 'contact_id', 'recurring']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (field in body) {
      if (field === 'completed') {
        const isCompleted = body[field] ? 1 : 0
        updates.push(`${field} = $${i++}`)
        values.push(isCompleted)
        updates.push(`completed_at = $${i++}`)
        values.push(isCompleted ? new Date().toISOString() : null)
      } else {
        updates.push(`${field} = $${i++}`)
        values.push(body[field] ?? null)
      }
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Geen velden om te updaten' }, { status: 400 })

  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE todos SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne('SELECT * FROM todos WHERE id = $1', [id])
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const rowCount = await execute('DELETE FROM todos WHERE id = $1', [id])
  if (rowCount === 0) return NextResponse.json({ error: 'Todo niet gevonden' }, { status: 404 })
  return NextResponse.json({ message: 'Todo verwijderd' })
}
