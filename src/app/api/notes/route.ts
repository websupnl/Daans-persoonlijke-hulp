export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const projectId = searchParams.get('project_id')
  const tag = searchParams.get('tag')

  let query: string
  let args: (string | number)[] = []

  if (search) {
    query = `
      SELECT n.*, p.title as project_title, p.color as project_color, c.name as contact_name
      FROM notes n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN contacts c ON n.contact_id = c.id
      WHERE n.id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
      ORDER BY n.pinned DESC, n.updated_at DESC
    `
    args = [search]
  } else {
    query = `
      SELECT n.*, p.title as project_title, p.color as project_color, c.name as contact_name
      FROM notes n
      LEFT JOIN projects p ON n.project_id = p.id
      LEFT JOIN contacts c ON n.contact_id = c.id
      WHERE 1=1
    `
    if (projectId) { query += ' AND n.project_id = ?'; args.push(parseInt(projectId)) }
    if (tag) { query += ' AND n.tags LIKE ?'; args.push(`%"${tag}"%`) }
    query += ' ORDER BY n.pinned DESC, n.updated_at DESC'
  }

  const notes = toRows(await db.execute({ sql: query, args })).map((n) => ({
    ...n,
    tags: JSON.parse(n.tags as string || '[]'),
  }))

  return NextResponse.json({ data: notes })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { title, content, content_text, tags, project_id, contact_id, pinned } = body

  const result = await db.execute({
    sql: `INSERT INTO notes (title, content, content_text, tags, project_id, contact_id, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      title || 'Naamloze note',
      content || '',
      content_text || '',
      JSON.stringify(tags || []),
      project_id || null,
      contact_id || null,
      pinned ? 1 : 0,
    ],
  })

  const note = toRow(await db.execute({ sql: 'SELECT * FROM notes WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
  return NextResponse.json({ data: { ...note, tags: JSON.parse(note?.tags as string || '[]') } }, { status: 201 })
}
