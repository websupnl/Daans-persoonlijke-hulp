export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = `
    SELECT e.*, p.title as project_title, p.color as project_color, c.name as contact_name
    FROM events e
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN contacts c ON e.contact_id = c.id
    WHERE 1=1
  `
  const args: (string | number)[] = []

  if (date) { query += ' AND e.date = ?'; args.push(date) }
  else if (from && to) { query += ' AND e.date BETWEEN ? AND ?'; args.push(from, to) }
  else {
    // Default: komende 30 dagen
    query += " AND e.date >= date('now')"
  }

  query += ' ORDER BY e.date ASC, e.time ASC'

  const events = toRows(await db.execute({ sql: query, args }))
  return NextResponse.json({ data: events })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { title, description, date, time, duration, type, project_id, contact_id, all_day } = body

  if (!title?.trim() || !date) return NextResponse.json({ error: 'Titel en datum zijn verplicht' }, { status: 400 })

  const result = await db.execute({
    sql: `INSERT INTO events (title, description, date, time, duration, type, project_id, contact_id, all_day)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [title.trim(), description || null, date, time || null, duration || 60,
           type || 'algemeen', project_id || null, contact_id || null, all_day ? 1 : 0],
  })

  const event = toRow(await db.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
  return NextResponse.json({ data: event }, { status: 201 })
}
