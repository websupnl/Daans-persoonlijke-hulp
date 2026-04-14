import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const type = searchParams.get('type')

  let query = 'SELECT * FROM contacts WHERE 1=1'
  const args: (string | number)[] = []

  if (search) {
    query += ' AND (name LIKE ? OR email LIKE ? OR company LIKE ?)'
    args.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (type) {
    query += ' AND type = ?'
    args.push(type)
  }

  query += ' ORDER BY name ASC'

  const contacts = toRows(await db.execute({ sql: query, args })).map((c) => ({
    ...c,
    tags: JSON.parse(c.tags as string || '[]'),
  }))

  return NextResponse.json({ data: contacts })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { name, type, email, phone, company, website, address, notes, tags } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })

  const result = await db.execute({
    sql: `INSERT INTO contacts (name, type, email, phone, company, website, address, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      name.trim(),
      type || 'persoon',
      email || null,
      phone || null,
      company || null,
      website || null,
      address || null,
      notes || null,
      JSON.stringify(tags || []),
    ],
  })

  const contact = toRow(await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
  return NextResponse.json({ data: { ...contact, tags: JSON.parse(contact?.tags as string || '[]') } }, { status: 201 })
}
