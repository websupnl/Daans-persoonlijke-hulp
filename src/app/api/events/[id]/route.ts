export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'
import { ensureWorkspaceColumns, getWorkspaceFromRequest } from '@/lib/workspace'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureWorkspaceColumns(['events'])
    const workspace = getWorkspaceFromRequest(req)
    const body = await req.json()
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('EVENT_ID_INVALID', 'Ongeldig event id', 400, undefined, req)

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

    if (updates.length === 0) return jsonFail('EVENT_NO_FIELDS', 'Geen velden', 400, undefined, req)
    updates.push(`updated_at = NOW()`)
    values.push(id, workspace)

    await execute(`UPDATE events SET ${updates.join(', ')} WHERE id = $${i} AND workspace = $${i + 1}`, values)
    const updated = await queryOne(`SELECT *, TO_CHAR(date,'YYYY-MM-DD') as date FROM events WHERE id = $1 AND workspace = $2`, [id, workspace])
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
    return jsonOk(updated, undefined, req)
  } catch (error: unknown) {
    return jsonFail('EVENT_UPDATE_FAILED', 'Kon event niet bijwerken', 500, error, req)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await ensureWorkspaceColumns(['events'])
    const workspace = getWorkspaceFromRequest(_req)
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('EVENT_ID_INVALID', 'Ongeldig event id', 400, undefined, _req)
    await execute(`DELETE FROM events WHERE id = $1 AND workspace = $2`, [id, workspace])
    await logActivity({ entityType: 'event', entityId: id, action: 'deleted', title: `Event ${params.id}`, summary: 'Agenda-item verwijderd' })
    return jsonOk({ message: 'Event verwijderd' }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('EVENT_DELETE_FAILED', 'Kon event niet verwijderen', 500, error, _req)
  }
}
