import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { format, subDays } from 'date-fns'

export async function GET() {
  const db = getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const monthAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const habits = db.prepare('SELECT * FROM habits WHERE active = 1 ORDER BY created_at').all()

  const enriched = (habits as Record<string, unknown>[]).map((h) => {
    const logs = db.prepare(
      'SELECT * FROM habit_logs WHERE habit_id = ? AND logged_date >= ? ORDER BY logged_date DESC'
    ).all(h.id, monthAgo)

    const completedToday = !!(db.prepare(
      'SELECT id FROM habit_logs WHERE habit_id = ? AND logged_date = ?'
    ).get(h.id, today))

    // Bereken streak
    let streak = 0
    let checkDate = today
    while (true) {
      const log = db.prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND logged_date = ?').get(h.id, checkDate)
      if (!log) break
      streak++
      checkDate = format(subDays(new Date(checkDate), 1), 'yyyy-MM-dd')
    }

    return { ...h, logs, completedToday, streak }
  })

  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { name, description, frequency, target, color, icon } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO habits (name, description, frequency, target, color, icon)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name.trim(), description || null, frequency || 'dagelijks', target || 1, color || '#6172f3', icon || '⭐')

  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json({ data: habit }, { status: 201 })
}
