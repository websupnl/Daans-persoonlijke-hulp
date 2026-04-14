import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { format } from 'date-fns'

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { habit_id, note, date } = body

  const logDate = date || format(new Date(), 'yyyy-MM-dd')

  try {
    await db.execute({
      sql: `INSERT OR REPLACE INTO habit_logs (habit_id, logged_date, note) VALUES (?, ?, ?)`,
      args: [habit_id, logDate, note || null],
    })
    return NextResponse.json({ message: 'Gelogged!', date: logDate })
  } catch {
    return NextResponse.json({ error: 'Kan niet loggen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const habitId = searchParams.get('habit_id')
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')

  await db.execute({ sql: 'DELETE FROM habit_logs WHERE habit_id = ? AND logged_date = ?', args: [habitId!, date] })
  return NextResponse.json({ message: 'Log verwijderd' })
}
