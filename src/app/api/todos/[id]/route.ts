export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'

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
  await syncEntityLinks({
    sourceType: 'todo',
    sourceId: id,
    projectId: Number((updated as Record<string, unknown> | undefined)?.project_id || 0) || null,
    contactId: Number((updated as Record<string, unknown> | undefined)?.contact_id || 0) || null,
    tags: [String((updated as Record<string, unknown> | undefined)?.category || 'overig')],
  })
  await logActivity({
    entityType: 'todo',
    entityId: id,
    action: body.completed ? 'completed' : 'updated',
    title: String((updated as Record<string, unknown> | undefined)?.title || `Todo ${id}`),
    summary: body.completed ? 'Todo afgerond' : 'Todo bijgewerkt',
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const rowCount = await execute('DELETE FROM todos WHERE id = $1', [id])
  if (rowCount === 0) return NextResponse.json({ error: 'Todo niet gevonden' }, { status: 404 })
  await logActivity({ entityType: 'todo', entityId: id, action: 'deleted', title: `Todo ${id}`, summary: 'Todo verwijderd' })
  return NextResponse.json({ message: 'Todo verwijderd' })
}
