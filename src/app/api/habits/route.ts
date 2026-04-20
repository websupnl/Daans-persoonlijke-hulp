export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { format, subDays } from 'date-fns'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET() {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const monthAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const sixtyDaysAgo = format(subDays(new Date(), 60), 'yyyy-MM-dd')

    const habits = await query<Record<string, unknown>>('SELECT * FROM habits WHERE active = 1 ORDER BY created_at')

    const enriched = await Promise.all(habits.map(async (h) => {
    const rawLogs = await query<{ logged_date: string | Date }>(
      'SELECT logged_date FROM habit_logs WHERE habit_id = $1 AND logged_date >= $2 ORDER BY logged_date DESC',
      [h.id, monthAgo]
    )
    // Normalize dates: pg returns DATE columns as JS Date objects or ISO strings
    const normDate = (d: string | Date) => typeof d === 'string' ? d.slice(0, 10) : format(d, 'yyyy-MM-dd')
    const logs = rawLogs.map(l => ({ logged_date: normDate(l.logged_date) }))

    const completedToday = logs.some(l => l.logged_date === today)

    // Fetch logs for last 60 days and calculate streak in JS
    const recentLogs = await query<{ logged_date: string | Date }>(
      'SELECT logged_date FROM habit_logs WHERE habit_id = $1 AND logged_date >= $2 ORDER BY logged_date DESC',
      [h.id, sixtyDaysAgo]
    )
    const logSet = new Set(recentLogs.map(l => normDate(l.logged_date)))

    let streak = 0
    let checkDate = today
    for (let d = 0; d <= 60; d++) {
      const dateStr = format(subDays(new Date(today), d), 'yyyy-MM-dd')
      if (logSet.has(dateStr)) {
        streak++
        checkDate = dateStr
      } else {
        break
      }
      void checkDate
    }

    return { ...h, logs, completedToday, streak }
    }))

    return jsonOk(enriched)
  } catch (error: unknown) {
    return jsonFail('HABITS_LIST_FAILED', 'Kon gewoontes niet ophalen', 500, error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, frequency, target, color, icon } = body

    if (!name?.trim()) return jsonFail('HABIT_VALIDATION', 'Naam verplicht', 400, undefined, req)

    const habit = await queryOne(`
    INSERT INTO habits (name, description, frequency, target, color, icon)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [name.trim(), description || null, frequency || 'dagelijks', target || 1, color || '#6172f3', icon || '⭐'])

    return jsonOk(habit, { status: 201 }, req)
  } catch (error: unknown) {
    return jsonFail('HABIT_CREATE_FAILED', 'Kon gewoonte niet aanmaken', 500, error, req)
  }
}
