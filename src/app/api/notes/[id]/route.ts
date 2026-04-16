export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { generateTags } from '@/lib/ai/note-utils'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const note = await queryOne<Record<string, unknown>>('SELECT * FROM notes WHERE id = $1', [parseInt(params.id)])
  if (!note) return NextResponse.json({ error: 'Note niet gevonden' }, { status: 404 })
  return NextResponse.json({ data: { ...note, tags: JSON.parse(note.tags as string || '[]') } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
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

  if (updates.length === 0) return NextResponse.json({ error: 'Geen velden' }, { status: 400 })
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
  return NextResponse.json({ data: { ...updated, tags: JSON.parse(updated?.tags as string || '[]') } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute('DELETE FROM notes WHERE id = $1', [parseInt(params.id)])
  await logActivity({ entityType: 'note', entityId: parseInt(params.id), action: 'deleted', title: `Note ${params.id}`, summary: 'Note verwijderd' })
  return NextResponse.json({ message: 'Note verwijderd' })
}
