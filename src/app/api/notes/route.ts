export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const projectId = searchParams.get('project_id')
  const tag = searchParams.get('tag')

  let sql: string
  const params: unknown[] = []
  let i = 1

  if (search) {
    sql = `
      SELECT n.*, p.title as project_title, p.color as project_color, c.name as contact_name
      FROM notes n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN contacts c ON n.contact_id = c.id
      WHERE (n.title ILIKE $${i} OR n.content_text ILIKE $${i})
      ORDER BY n.pinned DESC, n.updated_at DESC
    `
    params.push(`%${search}%`)
  } else {
    sql = `
      SELECT n.*, p.title as project_title, p.color as project_color, c.name as contact_name
      FROM notes n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN contacts c ON n.contact_id = c.id
      WHERE 1=1
    `
    if (projectId) { sql += ` AND n.project_id = $${i++}`; params.push(parseInt(projectId)) }
    if (tag) { sql += ` AND n.tags LIKE $${i++}`; params.push(`%"${tag}"%`) }
    sql += ' ORDER BY n.pinned DESC, n.updated_at DESC'
  }

  const notes = (await query<Record<string, unknown>>(sql, params)).map((n) => ({
    ...n,
    tags: JSON.parse(n.tags as string || '[]'),
  }))

  return NextResponse.json({ data: notes })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, content, content_text, tags, project_id, contact_id, pinned } = body

  const note = await queryOne<Record<string, unknown>>(`
    INSERT INTO notes (title, content, content_text, tags, project_id, contact_id, pinned)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    title || 'Naamloze note',
    content || '',
    content_text || '',
    JSON.stringify(tags || []),
    project_id || null,
    contact_id || null,
    pinned ? 1 : 0,
  ])

  return NextResponse.json({ data: { ...note, tags: JSON.parse(note?.tags as string || '[]') } }, { status: 201 })
}
