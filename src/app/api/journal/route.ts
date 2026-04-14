import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const list = searchParams.get('list')

  if (list) {
    const entries = toRows(await db.execute('SELECT id, date, mood, energy, highlights FROM journal_entries ORDER BY date DESC LIMIT 30'))
    return NextResponse.json({ data: entries })
  }

  let entry = toRow(await db.execute({ sql: 'SELECT * FROM journal_entries WHERE date = ?', args: [date] }))

  if (!entry) {
    await db.execute({ sql: `INSERT OR IGNORE INTO journal_entries (date, content, gratitude) VALUES (?, '', '[]')`, args: [date] })
    entry = toRow(await db.execute({ sql: 'SELECT * FROM journal_entries WHERE date = ?', args: [date] }))
  }

  return NextResponse.json({ data: { ...entry, gratitude: JSON.parse(entry?.gratitude as string || '[]') } })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { date, content, mood, energy, gratitude, highlights } = body

  const entryDate = date || format(new Date(), 'yyyy-MM-dd')

  await db.execute({
    sql: `
      INSERT INTO journal_entries (date, content, mood, energy, gratitude, highlights)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        content = excluded.content,
        mood = excluded.mood,
        energy = excluded.energy,
        gratitude = excluded.gratitude,
        highlights = excluded.highlights,
        updated_at = datetime('now')
    `,
    args: [entryDate, content || '', mood || null, energy || null, JSON.stringify(gratitude || []), highlights || null],
  })

  const entry = toRow(await db.execute({ sql: 'SELECT * FROM journal_entries WHERE date = ?', args: [entryDate] }))
  return NextResponse.json({ data: { ...entry, gratitude: JSON.parse(entry?.gratitude as string || '[]') } })
}
