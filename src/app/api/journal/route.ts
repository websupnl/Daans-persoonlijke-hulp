import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const list = searchParams.get('list')

  if (list) {
    const entries = db.prepare('SELECT id, date, mood, energy, highlights FROM journal_entries ORDER BY date DESC LIMIT 30').all()
    return NextResponse.json({ data: entries })
  }

  let entry = db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(date) as Record<string, unknown> | undefined

  if (!entry) {
    // Maak entry aan voor vandaag als die niet bestaat
    db.prepare(`INSERT OR IGNORE INTO journal_entries (date, content, gratitude) VALUES (?, '', '[]')`).run(date)
    entry = db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(date) as Record<string, unknown>
  }

  return NextResponse.json({ data: { ...entry, gratitude: JSON.parse(entry.gratitude as string || '[]') } })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { date, content, mood, energy, gratitude, highlights } = body

  const entryDate = date || format(new Date(), 'yyyy-MM-dd')

  db.prepare(`
    INSERT INTO journal_entries (date, content, mood, energy, gratitude, highlights)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      content = excluded.content,
      mood = excluded.mood,
      energy = excluded.energy,
      gratitude = excluded.gratitude,
      highlights = excluded.highlights,
      updated_at = datetime('now')
  `).run(
    entryDate,
    content || '',
    mood || null,
    energy || null,
    JSON.stringify(gratitude || []),
    highlights || null
  )

  const entry = db.prepare('SELECT * FROM journal_entries WHERE date = ?').get(entryDate) as Record<string, unknown>
  return NextResponse.json({ data: { ...entry, gratitude: JSON.parse(entry.gratitude as string || '[]') } })
}
