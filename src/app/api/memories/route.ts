export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const memories = toRows(await db.execute('SELECT * FROM memories ORDER BY updated_at DESC'))
  return NextResponse.json({ data: memories })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { value, category } = body

  if (!value?.trim()) return NextResponse.json({ error: 'Value is verplicht' }, { status: 400 })

  const key = value.trim().slice(0, 60)
  await db.execute({
    sql: 'INSERT OR REPLACE INTO memories (key, value, category) VALUES (?, ?, ?)',
    args: [key, value.trim(), category || 'algemeen'],
  })

  const memory = toRow(await db.execute({ sql: 'SELECT * FROM memories WHERE key = ?', args: [key] }))
  return NextResponse.json({ data: memory }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM memories WHERE id = ?', args: [parseInt(id)] })
  return NextResponse.json({ message: 'Memory verwijderd' })
}
