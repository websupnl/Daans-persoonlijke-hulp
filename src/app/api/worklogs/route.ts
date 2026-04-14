import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const context = searchParams.get('context')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  let sql = `SELECT w.*, p.title as project_title FROM work_logs w LEFT JOIN projects p ON w.project_id = p.id WHERE 1=1`
  const params: unknown[] = []
  let i = 1

  if (date) { sql += ` AND w.date = $${i++}`; params.push(date) }
  if (context) { sql += ` AND w.context = $${i++}`; params.push(context) }

  sql += ` ORDER BY w.date DESC, w.created_at DESC LIMIT $${i++}`
  params.push(limit)

  const logs = await query(sql, params)

  const stats = await query(`
    SELECT context, SUM(duration_minutes) as total_minutes, COUNT(*) as count
    FROM work_logs GROUP BY context ORDER BY total_minutes DESC
  `)

  const todayStats = await queryOne<{ today_minutes: number }>(`
    SELECT SUM(duration_minutes) as today_minutes FROM work_logs WHERE date = CURRENT_DATE
  `)

  const weekStats = await queryOne<{ week_minutes: number }>(`
    SELECT SUM(duration_minutes) as week_minutes FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  `)

  return NextResponse.json({ logs, stats, todayStats, weekStats })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { title, duration_minutes, context, date, description, project_id, energy_level } = body

  if (!title || !duration_minutes || !context) {
    return NextResponse.json({ error: 'title, duration_minutes en context zijn verplicht' }, { status: 400 })
  }

  const log = await queryOne(`
    INSERT INTO work_logs (title, duration_minutes, context, date, description, project_id, energy_level)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [title, duration_minutes, context, date ?? new Date().toISOString().split('T')[0], description ?? null, project_id ?? null, energy_level ?? null])

  return NextResponse.json({ log }, { status: 201 })
}
