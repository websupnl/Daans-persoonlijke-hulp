export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = req.nextUrl

  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const projectId = searchParams.get('project_id')
  const category = searchParams.get('category')
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '100')

  let sql = `
    SELECT w.*, p.title as project_title, p.color as project_color
    FROM worklogs w
    LEFT JOIN projects p ON w.project_id = p.id
  `
  const args: (string | number | null)[] = []
  const conditions: string[] = []

  if (date) {
    conditions.push("date(w.start_time) = ?")
    args.push(date)
  } else if (from && to) {
    conditions.push("date(w.start_time) BETWEEN ? AND ?")
    args.push(from, to)
  }

  if (projectId) {
    conditions.push("w.project_id = ?")
    args.push(parseInt(projectId))
  }
  if (category) {
    conditions.push("w.category = ?")
    args.push(category)
  }
  if (type) {
    conditions.push("w.type = ?")
    args.push(type)
  }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY w.start_time DESC, w.created_at DESC LIMIT ?'
  args.push(limit)

  const rows = toRows(await db.execute({ sql, args }))
  return NextResponse.json({ data: rows })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()

  const {
    title, description, project_id, category = 'business',
    type = 'deep_work', start_time, end_time,
    duration_minutes, expected_duration_minutes, actual_duration_minutes,
    difficulty = 'normal', context_notes, interruptions,
    billable = false, hourly_rate, source = 'manual',
  } = body

  // Auto-calculate duration from times
  let dur = duration_minutes ? parseInt(String(duration_minutes)) : null
  if (!dur && start_time && end_time) {
    dur = Math.round((new Date(end_time).getTime() - new Date(start_time).getTime()) / 60000)
  }

  const actualDur = actual_duration_minutes ? parseInt(String(actual_duration_minutes)) : (dur || null)
  const expectedDur = expected_duration_minutes ? parseInt(String(expected_duration_minutes)) : null

  // Default start_time to now if not provided
  const resolvedStart = start_time || new Date().toISOString()

  const id = `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  await db.execute({
    sql: `INSERT INTO worklogs
      (id, title, description, project_id, category, type, start_time, end_time,
       duration_minutes, expected_duration_minutes, actual_duration_minutes,
       difficulty, context_notes, interruptions, billable, hourly_rate, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, title || null, description || null,
      project_id ? parseInt(String(project_id)) : null,
      category, type,
      resolvedStart, end_time || null,
      dur, expectedDur, actualDur,
      difficulty, context_notes || null, interruptions || null,
      billable ? 1 : 0, hourly_rate ? parseFloat(String(hourly_rate)) : null, source,
    ],
  })

  const row = toRow(await db.execute({
    sql: 'SELECT w.*, p.title as project_title, p.color as project_color FROM worklogs w LEFT JOIN projects p ON w.project_id = p.id WHERE w.id = ?',
    args: [id],
  }))
  return NextResponse.json({ data: row }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const db = await getDb()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Geen id' }, { status: 400 })
  await db.execute({ sql: 'DELETE FROM worklogs WHERE id = ?', args: [id] })
  return NextResponse.json({ message: 'Verwijderd' })
}
