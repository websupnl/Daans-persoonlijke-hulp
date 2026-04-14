import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const projects = await query(`
    SELECT p.*,
      COUNT(DISTINCT CASE WHEN t.completed = 0 THEN t.id END) as open_todos,
      COUNT(DISTINCT t.id) as total_todos,
      COUNT(DISTINCT n.id) as note_count
    FROM projects p
    LEFT JOIN todos t ON t.project_id = p.id
    LEFT JOIN notes n ON n.project_id = p.id
    GROUP BY p.id
    ORDER BY p.status = 'afgerond', p.created_at DESC
  `)
  return NextResponse.json({ data: projects })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, status, color } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })

  const project = await queryOne(`
    INSERT INTO projects (title, description, status, color) VALUES ($1, $2, $3, $4) RETURNING *
  `, [title.trim(), description || null, status || 'actief', color || '#6172f3'])

  return NextResponse.json({ data: project }, { status: 201 })
}
