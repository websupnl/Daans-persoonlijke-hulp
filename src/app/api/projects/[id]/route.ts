export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, execute, query } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const [project, todos, notes, worklogs, finance] = await Promise.all([
    queryOne(`
      SELECT p.*,
        (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id AND t.completed = 0)::int as open_todos,
        (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id)::int as total_todos,
        (SELECT COUNT(*) FROM notes n WHERE n.project_id = p.id)::int as note_count,
        (SELECT COALESCE(SUM(COALESCE(wl.actual_duration_minutes, wl.duration_minutes)), 0) FROM work_logs wl WHERE wl.project_id = p.id)::int as total_minutes
      FROM projects p
      WHERE p.id = $1
    `, [id]),
    query(`SELECT * FROM todos WHERE project_id = $1 ORDER BY completed ASC, CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`, [id]),
    query(`SELECT id, title, content_text, tags, pinned, created_at FROM notes WHERE project_id = $1 ORDER BY pinned DESC, created_at DESC`, [id]),
    query(`SELECT id, title, date, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes, context, source FROM work_logs WHERE project_id = $1 ORDER BY date DESC, created_at DESC LIMIT 50`, [id]),
    query(`SELECT id, type, title, amount, status, due_date FROM finance_items WHERE project_id = $1 ORDER BY created_at DESC`, [id]),
  ])
  if (!project) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json({ data: project, todos, notes, worklogs, finance })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)
  const body = await req.json()

  const fields = ['title', 'description', 'status', 'color']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (field in body) {
      updates.push(`${field} = $${i++}`)
      values.push(body[field] ?? null)
    }
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne('SELECT * FROM projects WHERE id = $1', [id])
  await logActivity({
    entityType: 'project',
    entityId: id,
    action: 'updated',
    title: String((updated as Record<string, unknown> | undefined)?.title || `Project ${id}`),
    summary: 'Project bijgewerkt',
  })
  return NextResponse.json({ data: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute('DELETE FROM projects WHERE id = $1', [parseInt(params.id)])
  await logActivity({ entityType: 'project', entityId: parseInt(params.id), action: 'deleted', title: `Project ${params.id}`, summary: 'Project verwijderd' })
  return NextResponse.json({ message: 'Project verwijderd' })
}
