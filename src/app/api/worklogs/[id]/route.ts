export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()
  const fields = [
    'title',
    'description',
    'date',
    'context',
    'duration_minutes',
    'actual_duration_minutes',
    'energy_level',
    'category',
    'type',
  ]

  const updates: string[] = []
  const values: unknown[] = []
  let index = 1

  for (const field of fields) {
    if (body[field] === undefined) continue
    updates.push(`${field} = $${index++}`)
    values.push(body[field] === '' ? null : body[field])
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Geen wijzigingen' }, { status: 400 })
  }

  values.push(parseInt(params.id))
  const updated = await queryOne(
    `UPDATE work_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${index} RETURNING *`,
    values
  )

  await logActivity({
    entityType: 'worklog',
    entityId: parseInt(params.id),
    action: 'updated',
    title: String(body.title || `Werklog ${params.id}`),
    summary: 'Werklog bijgewerkt',
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  await execute(`DELETE FROM work_logs WHERE id = $1`, [parseInt(params.id)])
  await logActivity({ entityType: 'worklog', entityId: parseInt(params.id), action: 'deleted', title: `Werklog ${params.id}`, summary: 'Werklog verwijderd' })
  return NextResponse.json({ success: true })
}
