export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter')
  const projectId = searchParams.get('project_id')
  const category = searchParams.get('category')
  const completed = searchParams.get('completed')

  let query = `
    SELECT t.*,
      p.title as project_title, p.color as project_color,
      c.name as contact_name
    FROM todos t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN contacts c ON t.contact_id = c.id
    WHERE 1=1
  `
  const args: (string | number | null)[] = []

  if (completed === '1') {
    query += ' AND t.completed = 1'
  } else if (completed === '0' || !completed) {
    query += ' AND t.completed = 0'
  }

  if (filter === 'today' || filter === 'vandaag') {
    query += " AND date(t.due_date) = date('now')"
  } else if (filter === 'week' || filter === 'deze week') {
    query += " AND date(t.due_date) <= date('now', '+7 days')"
  } else if (filter === 'overdue' || filter === 'te laat') {
    query += " AND date(t.due_date) < date('now') AND t.completed = 0"
  }

  if (projectId) {
    query += ' AND t.project_id = ?'
    args.push(parseInt(projectId))
  }
  if (category) {
    query += ' AND t.category = ?'
    args.push(category)
  }

  query += ' ORDER BY CASE t.priority WHEN "hoog" THEN 0 WHEN "medium" THEN 1 ELSE 2 END, t.due_date ASC, t.created_at DESC'

  const todos = toRows(await db.execute({ sql: query, args }))
  return NextResponse.json({ data: todos })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { title, description, category, priority, due_date, project_id, contact_id, recurring } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
  }

  const result = await db.execute({
    sql: `INSERT INTO todos (title, description, category, priority, due_date, project_id, contact_id, recurring) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      title.trim(),
      description || null,
      category || 'overig',
      priority || 'medium',
      due_date || null,
      project_id || null,
      contact_id || null,
      recurring || null,
    ],
  })

  const todo = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
  return NextResponse.json({ data: todo }, { status: 201 })
}
