import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'status', 'color']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      values.push(body[field] ?? null)
    }
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ?').run(parseInt(params.id))
  return NextResponse.json({ message: 'Project verwijderd' })
}
