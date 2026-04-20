export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { generateTags } from '@/lib/ai/note-utils'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('NOTE_ID_INVALID', 'Ongeldig note id', 400, undefined, _req)
    const note = await queryOne<Record<string, unknown>>('SELECT * FROM notes WHERE id = $1', [id])
    if (!note) return jsonFail('NOTE_NOT_FOUND', 'Note niet gevonden', 404, undefined, _req)
    return jsonOk({ ...note, tags: JSON.parse(note.tags as string || '[]') }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('NOTE_GET_FAILED', 'Kon note niet ophalen', 500, error, _req)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('NOTE_ID_INVALID', 'Ongeldig note id', 400, undefined, req)
    const body = await req.json()

  // Auto-tagging if content changed and tags are empty
    if (body.content_text && (!body.tags || body.tags.length === 0)) {
      const aiTags = await generateTags(body.content_text)
      if (aiTags.length > 0) body.tags = aiTags
    }

    const fields = ['title', 'content', 'content_text', 'tags', 'project_id', 'contact_id', 'pinned']
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    for (const field of fields) {
      if (field in body) {
        updates.push(`${field} = $${i++}`)
        if (field === 'tags') {
          values.push(JSON.stringify(body[field] || []))
        } else if (field === 'pinned') {
          values.push(body[field] ? 1 : 0)
        } else {
          values.push(body[field] ?? null)
        }
      }
    }

    if (updates.length === 0) return jsonFail('NOTE_NO_FIELDS', 'Geen velden', 400, undefined, req)
    updates.push(`updated_at = NOW()`)
    values.push(id)

    await execute(`UPDATE notes SET ${updates.join(', ')} WHERE id = $${i}`, values)
    const updated = await queryOne<Record<string, unknown>>('SELECT * FROM notes WHERE id = $1', [id])
    await syncEntityLinks({
      sourceType: 'note',
      sourceId: id,
      projectId: Number(updated?.project_id || 0) || null,
      contactId: Number(updated?.contact_id || 0) || null,
      tags: JSON.parse(String(updated?.tags || '[]')),
    })
    await logActivity({
      entityType: 'note',
      entityId: id,
      action: 'updated',
      title: String(updated?.title || `Note ${id}`),
      summary: 'Note bijgewerkt',
    })
    return jsonOk({ ...updated, tags: JSON.parse(updated?.tags as string || '[]') }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('NOTE_UPDATE_FAILED', 'Kon note niet bijwerken', 500, error, req)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    if (Number.isNaN(id)) return jsonFail('NOTE_ID_INVALID', 'Ongeldig note id', 400, undefined, _req)
    await execute('DELETE FROM notes WHERE id = $1', [id])
    await logActivity({ entityType: 'note', entityId: id, action: 'deleted', title: `Note ${params.id}`, summary: 'Note verwijderd' })
    return jsonOk({ message: 'Note verwijderd' }, undefined, _req)
  } catch (error: unknown) {
    return jsonFail('NOTE_DELETE_FAILED', 'Kon note niet verwijderen', 500, error, _req)
  }
}
