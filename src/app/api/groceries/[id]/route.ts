export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('GROCERY_ID_INVALID', 'Ongeldig grocery id', 400, undefined, req)
    const body = await req.json()
    const { title, quantity, category, completed } = body

    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title) }
    if (quantity !== undefined) { updates.push(`quantity = $${i++}`); values.push(quantity) }
    if (category !== undefined) { updates.push(`category = $${i++}`); values.push(category) }
    if (completed !== undefined) { updates.push(`completed = $${i++}`); values.push(completed ? 1 : 0) }

    if (updates.length === 0) return jsonFail('GROCERY_NO_FIELDS', 'Geen updates', 400, undefined, req)

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

    return jsonOk(item, undefined, req)
  } catch (error: unknown) {
    return jsonFail('GROCERY_UPDATE_FAILED', 'Kon boodschap niet bijwerken', 500, error, req)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('GROCERY_ID_INVALID', 'Ongeldig grocery id', 400, undefined, req)
    await execute('DELETE FROM groceries WHERE id = $1', [id])
    return jsonOk({ message: 'Verwijderd' }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('GROCERY_DELETE_FAILED', 'Kon boodschap niet verwijderen', 500, error, req)
  }
}
