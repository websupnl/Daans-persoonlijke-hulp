export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { execute } from '@/lib/db'
import { format } from 'date-fns'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

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

    return jsonOk({ message: 'Gelogged!', date: logDate }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('HABIT_LOG_FAILED', 'Kan niet loggen', 500, error, req)
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const habitId = searchParams.get('habit_id')
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')

  try {
    await execute('DELETE FROM habit_logs WHERE habit_id = $1 AND logged_date = $2', [habitId, date])
    return jsonOk({ message: 'Log verwijderd' }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('HABIT_LOG_DELETE_FAILED', 'Kon habit-log niet verwijderen', 500, error, req)
  }
}
