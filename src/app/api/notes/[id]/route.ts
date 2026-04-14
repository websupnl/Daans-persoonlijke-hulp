import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(parseInt(params.id)) as Record<string, unknown> | undefined
  if (!note) return NextResponse.json({ error: 'Note niet gevonden' }, { status: 404 })
  return NextResponse.json({ data: { ...note, tags: JSON.parse(note.tags as string || '[]') } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'content', 'content_text', 'tags', 'project_id', 'contact_id', 'pinned']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
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
  updates.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Record<string, unknown>
  return NextResponse.json({ data: { ...updated, tags: JSON.parse(updated.tags as string || '[]') } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM notes WHERE id = ?').run(parseInt(params.id))
  return NextResponse.json({ message: 'Note verwijderd' })
}
