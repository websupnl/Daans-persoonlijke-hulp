import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { format } from 'date-fns'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  const list = searchParams.get('list')

  if (list) {
    const entries = await query('SELECT id, date, mood, energy, highlights FROM journal_entries ORDER BY date DESC LIMIT 30')
    return NextResponse.json({ data: entries })
  }

  let entry = await queryOne<Record<string, unknown>>('SELECT * FROM journal_entries WHERE date = $1', [date])

  if (!entry) {
    // Maak entry aan voor vandaag als die niet bestaat
    await execute(`INSERT INTO journal_entries (date, content, gratitude) VALUES ($1, '', '[]') ON CONFLICT(date) DO NOTHING`, [date])
    entry = await queryOne<Record<string, unknown>>('SELECT * FROM journal_entries WHERE date = $1', [date])
  }

  return NextResponse.json({ data: { ...entry, gratitude: JSON.parse(entry?.gratitude as string || '[]') } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, content, mood, energy, gratitude, highlights } = body

  const entryDate = date || format(new Date(), 'yyyy-MM-dd')

  await execute(`
    INSERT INTO journal_entries (date, content, mood, energy, gratitude, highlights)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(date) DO UPDATE SET
      content = EXCLUDED.content,
      mood = EXCLUDED.mood,
      energy = EXCLUDED.energy,
      gratitude = EXCLUDED.gratitude,
      highlights = EXCLUDED.highlights,
      updated_at = NOW()
  `, [
    entryDate,
    content || '',
    mood || null,
    energy || null,
    JSON.stringify(gratitude || []),
    highlights || null,
  ])

  const entry = await queryOne<Record<string, unknown>>('SELECT * FROM journal_entries WHERE date = $1', [entryDate])
  return NextResponse.json({ data: { ...entry, gratitude: JSON.parse(entry?.gratitude as string || '[]') } })
}
