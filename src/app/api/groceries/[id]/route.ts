export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  const body = await req.json()
  const { title, quantity, category, completed } = body

  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title) }
  if (quantity !== undefined) { updates.push(`quantity = $${i++}`); values.push(quantity) }
  if (category !== undefined) { updates.push(`category = $${i++}`); values.push(category) }
  if (completed !== undefined) { updates.push(`completed = $${i++}`); values.push(completed ? 1 : 0) }

  if (updates.length === 0) return NextResponse.json({ error: 'Geen updates' }, { status: 400 })

  values.push(id)
  const sql = `
    UPDATE groceries
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${i}
    RETURNING *
  `
  const item = await queryOne(sql, values)

  if (item && completed !== undefined) {
    await logActivity({
      entityType: 'grocery',
      entityId: id,
      action: completed ? 'completed' : 'uncompleted',
      title: (item as any).title,
      summary: completed ? 'Boodschap afgevinkt' : 'Boodschap teruggezet',
    })
  }

  return NextResponse.json({ data: item })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id)
  await execute('DELETE FROM groceries WHERE id = $1', [id])
  return NextResponse.json({ message: 'Verwijderd' })
}
