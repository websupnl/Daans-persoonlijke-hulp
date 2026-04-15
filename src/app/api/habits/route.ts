export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'
import { format, subDays } from 'date-fns'

export async function GET() {
  const db = await getDb()
  const today = format(new Date(), 'yyyy-MM-dd')
  const monthAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

  const habits = toRows(await db.execute('SELECT * FROM habits WHERE active = 1 ORDER BY created_at'))

  const enriched = await Promise.all(habits.map(async (h) => {
    const logs = toRows(await db.execute({
      sql: 'SELECT * FROM habit_logs WHERE habit_id = ? AND logged_date >= ? ORDER BY logged_date DESC',
      args: [h.id as number, monthAgo],
    }))

    const todayLog = toRow(await db.execute({
      sql: 'SELECT id FROM habit_logs WHERE habit_id = ? AND logged_date = ?',
      args: [h.id as number, today],
    }))
    const completedToday = !!todayLog

    let streak = 0
    let checkDate = today
    while (true) {
      const log = toRow(await db.execute({
        sql: 'SELECT id FROM habit_logs WHERE habit_id = ? AND logged_date = ?',
        args: [h.id as number, checkDate],
      }))
      if (!log) break
      streak++
      checkDate = format(subDays(new Date(checkDate), 1), 'yyyy-MM-dd')
    }

    return { ...h, logs, completedToday, streak }
  }))

  return NextResponse.json({ data: enriched })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { name, description, frequency, target, color, icon } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })

  const result = await db.execute({
    sql: `INSERT INTO habits (name, description, frequency, target, color, icon) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [name.trim(), description || null, frequency || 'dagelijks', target || 1, color || '#6172f3', icon || '⭐'],
  })

  const habit = toRow(await db.execute({ sql: 'SELECT * FROM habits WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
  return NextResponse.json({ data: habit }, { status: 201 })
}
