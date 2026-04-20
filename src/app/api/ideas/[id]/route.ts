export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (Number.isNaN(id)) return jsonFail('IDEA_ID_INVALID', 'Ongeldig idee id', 400, undefined, req)
    const body = await req.json()

    const fields = ['title', 'raw_input', 'refined_summary', 'verdict', 'score', 'status', 'market_gap', 'next_steps', 'tags']
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    for (const field of fields) {
      if (!(field in body)) continue
      updates.push(`${field} = $${i++}`)
      if (field === 'next_steps' || field === 'tags') {
        values.push(JSON.stringify(body[field] || []))
      } else {
        values.push(body[field] ?? null)
      }
    }

    if (updates.length === 0) {
      return jsonFail('IDEA_NO_FIELDS', 'Geen velden om te updaten', 400, undefined, req)
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    await execute(`UPDATE ideas SET ${updates.join(', ')} WHERE id = $${i}`, values)
    const updated = await queryOne<Record<string, unknown>>('SELECT * FROM ideas WHERE id = $1', [id])
    await syncEntityLinks({
      sourceType: 'idea',
      sourceId: id,
      tags: JSON.parse(String(updated?.tags || '[]')),
    })
    await logActivity({
      entityType: 'idea',
      entityId: id,
      action: 'updated',
      title: String(updated?.title || `Idee ${id}`),
      summary: 'Idee bijgewerkt',
    })
    return jsonOk({
      ...updated,
      next_steps: JSON.parse(String(updated?.next_steps || '[]')),
      tags: JSON.parse(String(updated?.tags || '[]')),
    }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('IDEA_UPDATE_FAILED', 'Kon idee niet bijwerken', 500, error, req)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (Number.isNaN(id)) return jsonFail('IDEA_ID_INVALID', 'Ongeldig idee id', 400, undefined, _req)
    await execute('DELETE FROM ideas WHERE id = $1', [id])
    await logActivity({ entityType: 'idea', entityId: id, action: 'deleted', title: `Idee ${params.id}`, summary: 'Idee verwijderd' })
    return jsonOk({ success: true }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('IDEA_DELETE_FAILED', 'Kon idee niet verwijderen', 500, error, _req)
  }
}
