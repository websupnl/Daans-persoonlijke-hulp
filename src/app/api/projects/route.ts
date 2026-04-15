export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  const projects = toRows(await db.execute(`
    SELECT p.*,
      COUNT(DISTINCT CASE WHEN t.completed = 0 THEN t.id END) as open_todos,
      COUNT(DISTINCT t.id) as total_todos,
      COUNT(DISTINCT n.id) as note_count
    FROM projects p
    LEFT JOIN todos t ON t.project_id = p.id
    LEFT JOIN notes n ON n.project_id = p.id
    GROUP BY p.id
    ORDER BY p.status = 'afgerond', p.created_at DESC
  `))
  return NextResponse.json({ data: projects })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { title, description, status, color } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })

  const result = await db.execute({
    sql: `INSERT INTO projects (title, description, status, color) VALUES (?, ?, ?, ?)`,
    args: [title.trim(), description || null, status || 'actief', color || '#6172f3'],
  })

  const project = toRow(await db.execute({ sql: 'SELECT * FROM projects WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
  return NextResponse.json({ data: project }, { status: 201 })
}
