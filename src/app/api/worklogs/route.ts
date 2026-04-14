import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const context = searchParams.get('context')
  const limit = parseInt(searchParams.get('limit') ?? '20')

  let query = `SELECT w.*, p.title as project_title FROM work_logs w LEFT JOIN projects p ON w.project_id = p.id WHERE 1=1`
  const params: unknown[] = []

  if (date) { query += ` AND w.date = ?`; params.push(date) }
  if (context) { query += ` AND w.context = ?`; params.push(context) }

  query += ` ORDER BY w.date DESC, w.created_at DESC LIMIT ?`
  params.push(limit)

  const logs = db.prepare(query).all(...params)

  const stats = db.prepare(`
    SELECT context, SUM(duration_minutes) as total_minutes, COUNT(*) as count
    FROM work_logs GROUP BY context ORDER BY total_minutes DESC
  `).all()

  const todayStats = db.prepare(`
    SELECT SUM(duration_minutes) as today_minutes FROM work_logs WHERE date = date('now')
  `).get() as { today_minutes: number }

  const weekStats = db.prepare(`
    SELECT SUM(duration_minutes) as week_minutes FROM work_logs WHERE date >= date('now', '-7 days')
  `).get() as { week_minutes: number }

  return NextResponse.json({ logs, stats, todayStats, weekStats })
}

export async function POST(request: NextRequest) {
  const db = getDb()
  const body = await request.json()
  const { title, duration_minutes, context, date, description, project_id, energy_level } = body

  if (!title || !duration_minutes || !context) {
    return NextResponse.json({ error: 'title, duration_minutes en context zijn verplicht' }, { status: 400 })
  }

  const result = db.prepare(`
    INSERT INTO work_logs (title, duration_minutes, context, date, description, project_id, energy_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, duration_minutes, context, date ?? new Date().toISOString().split('T')[0], description ?? null, project_id ?? null, energy_level ?? null)

  const log = db.prepare(`SELECT * FROM work_logs WHERE id = ?`).get(result.lastInsertRowid)
  return NextResponse.json({ log }, { status: 201 })
}
