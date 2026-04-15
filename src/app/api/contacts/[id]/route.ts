export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const contact = await queryOne<Record<string, unknown>>('SELECT * FROM contacts WHERE id = $1', [id])
  if (!contact) return NextResponse.json({ error: 'Contact niet gevonden' }, { status: 404 })

  const todos = await query('SELECT id, title, priority, due_date, completed FROM todos WHERE contact_id = $1 ORDER BY completed, due_date', [id])
  const notes = await query('SELECT id, title, updated_at FROM notes WHERE contact_id = $1 ORDER BY updated_at DESC', [id])
  const finance = await query('SELECT id, title, type, amount, status, due_date FROM finance_items WHERE contact_id = $1 ORDER BY created_at DESC', [id])

  return NextResponse.json({
    data: {
      ...contact,
      tags: JSON.parse(contact.tags as string || '[]'),
      todos, notes, finance,
    }
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['name', 'type', 'email', 'phone', 'company', 'website', 'address', 'notes', 'tags', 'last_contact']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = $${i++}`)
      values.push(field === 'tags' ? JSON.stringify(body[field] || []) : (body[field] ?? null))
    }
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE contacts SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM contacts WHERE id = $1', [id])
  await syncEntityLinks({
    sourceType: 'contact',
    sourceId: id,
    companyName: String(updated?.company || ''),
    tags: JSON.parse(String(updated?.tags || '[]')),
  })
  await logActivity({
    entityType: 'contact',
    entityId: id,
    action: 'updated',
    title: String(updated?.name || `Contact ${id}`),
    summary: 'Contact bijgewerkt',
  })
  return NextResponse.json({ data: { ...updated, tags: JSON.parse(updated?.tags as string || '[]') } })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute('DELETE FROM contacts WHERE id = $1', [parseInt(params.id)])
  await logActivity({ entityType: 'contact', entityId: parseInt(params.id), action: 'deleted', title: `Contact ${params.id}`, summary: 'Contact verwijderd' })
  return NextResponse.json({ message: 'Contact verwijderd' })
}
