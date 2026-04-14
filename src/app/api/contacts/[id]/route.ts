import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const id = parseInt(params.id)
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!contact) return NextResponse.json({ error: 'Contact niet gevonden' }, { status: 404 })

  const todos = db.prepare('SELECT id, title, priority, due_date, completed FROM todos WHERE contact_id = ? ORDER BY completed, due_date').all(id)
  const notes = db.prepare('SELECT id, title, updated_at FROM notes WHERE contact_id = ? ORDER BY updated_at DESC').all(id)
  const finance = db.prepare('SELECT id, title, type, amount, status, due_date FROM finance_items WHERE contact_id = ? ORDER BY created_at DESC').all(id)

  return NextResponse.json({
    data: {
      ...contact,
      tags: JSON.parse(contact.tags as string || '[]'),
      todos, notes, finance,
    }
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['name', 'type', 'email', 'phone', 'company', 'website', 'address', 'notes', 'tags', 'last_contact']
  const updates: string[] = []
  const values: (string | number | null)[] = []

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      values.push(field === 'tags' ? JSON.stringify(body[field] || []) : (body[field] ?? null))
    }
  }

  updates.push("updated_at = datetime('now')")
  values.push(id)

  db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as Record<string, unknown>
  return NextResponse.json({ data: { ...updated, tags: JSON.parse(updated.tags as string || '[]') } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb()
  db.prepare('DELETE FROM contacts WHERE id = ?').run(parseInt(params.id))
  return NextResponse.json({ message: 'Contact verwijderd' })
}
