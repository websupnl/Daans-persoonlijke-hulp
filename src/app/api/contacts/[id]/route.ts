import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  const id = parseInt(params.id)
  const contact = toRow(await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [id] }))
  if (!contact) return NextResponse.json({ error: 'Contact niet gevonden' }, { status: 404 })

  const todos = toRows(await db.execute({ sql: 'SELECT id, title, priority, due_date, completed FROM todos WHERE contact_id = ? ORDER BY completed, due_date', args: [id] }))
  const notes = toRows(await db.execute({ sql: 'SELECT id, title, updated_at FROM notes WHERE contact_id = ? ORDER BY updated_at DESC', args: [id] }))
  const finance = toRows(await db.execute({ sql: 'SELECT id, title, type, amount, status, due_date FROM finance_items WHERE contact_id = ? ORDER BY created_at DESC', args: [id] }))

  return NextResponse.json({
    data: {
      ...contact,
      tags: JSON.parse(contact.tags as string || '[]'),
      todos, notes, finance,
    }
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
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

  await db.execute({ sql: `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, args: values })
  const updated = toRow(await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [id] }))
  return NextResponse.json({ data: { ...updated, tags: JSON.parse(updated?.tags as string || '[]') } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = await getDb()
  await db.execute({ sql: 'DELETE FROM contacts WHERE id = ?', args: [parseInt(params.id)] })
  return NextResponse.json({ message: 'Contact verwijderd' })
}
