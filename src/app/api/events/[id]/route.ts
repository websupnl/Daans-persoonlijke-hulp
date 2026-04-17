export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const id = parseInt(params.id)

  const fields = ['title', 'description', 'date', 'time', 'duration', 'type', 'project_id', 'contact_id', 'all_day']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = $${i++}`)
      if (field === 'all_day') {
        values.push(body[field] ? 1 : 0)
      } else {
        values.push(body[field] ?? null)
      }
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: 'Geen velden' }, { status: 400 })
  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE events SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne(`SELECT *, TO_CHAR(date,'YYYY-MM-DD') as date FROM events WHERE id = $1`, [id])
  await syncEntityLinks({
    sourceType: 'event',
    sourceId: id,
    projectId: Number((updated as Record<string, unknown> | undefined)?.project_id || 0) || null,
    contactId: Number((updated as Record<string, unknown> | undefined)?.contact_id || 0) || null,
    tags: [String((updated as Record<string, unknown> | undefined)?.type || 'algemeen')],
  })
  await logActivity({
    entityType: 'event',
    entityId: id,
    action: 'updated',
    title: String((updated as Record<string, unknown> | undefined)?.title || `Event ${id}`),
    summary: 'Agenda-item bijgewerkt',
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute(`DELETE FROM events WHERE id = $1`, [parseInt(params.id)])
  await logActivity({ entityType: 'event', entityId: parseInt(params.id), action: 'deleted', title: `Event ${params.id}`, summary: 'Agenda-item verwijderd' })
  return NextResponse.json({ message: 'Event verwijderd' })
}
