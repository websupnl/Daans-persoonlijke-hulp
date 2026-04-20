export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('TODO_ID_INVALID', 'Ongeldig todo id', 400, undefined, req)
    const body = await req.json()

    const existing = await queryOne('SELECT * FROM todos WHERE id = $1', [id])
    if (!existing) return jsonFail('TODO_NOT_FOUND', 'Todo niet gevonden', 404, undefined, req)

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

    if (updates.length === 0) return jsonFail('TODO_NO_FIELDS', 'Geen velden om te updaten', 400, undefined, req)

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
    return jsonOk(updated, undefined, req)
  } catch (error: unknown) {
    return jsonFail('TODO_UPDATE_FAILED', 'Kon todo niet bijwerken', 500, error, req)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('TODO_ID_INVALID', 'Ongeldig todo id', 400, undefined, _req)
    const rowCount = await execute('DELETE FROM todos WHERE id = $1', [id])
    if (rowCount === 0) return jsonFail('TODO_NOT_FOUND', 'Todo niet gevonden', 404, undefined, _req)
    await logActivity({ entityType: 'todo', entityId: id, action: 'deleted', title: `Todo ${id}`, summary: 'Todo verwijderd' })
    return jsonOk({ message: 'Todo verwijderd' }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('TODO_DELETE_FAILED', 'Kon todo niet verwijderen', 500, error, _req)
  }
}
