export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'
import { format } from 'date-fns'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { habit_id, note, date } = body

  const logDate = date || format(new Date(), 'yyyy-MM-dd')

  try {
    await execute(`
      INSERT INTO habit_logs (habit_id, logged_date, note)
      VALUES ($1, $2, $3)
      ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = EXCLUDED.note, created_at = EXCLUDED.created_at
    `, [habit_id, logDate, note || null])

    return NextResponse.json({ message: 'Gelogged!', date: logDate })
  } catch {
    return NextResponse.json({ error: 'Kan niet loggen' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const habitId = searchParams.get('habit_id')
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')

  await execute('DELETE FROM habit_logs WHERE habit_id = $1 AND logged_date = $2', [habitId, date])
  return NextResponse.json({ message: 'Log verwijderd' })
}
