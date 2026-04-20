export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET() {
  try {
    const projects = await query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id AND t.completed = 0)::int as open_todos,
        (SELECT COUNT(*) FROM todos t WHERE t.project_id = p.id)::int as total_todos,
        (SELECT COUNT(*) FROM notes n WHERE n.project_id = p.id)::int as note_count
      FROM projects p
      ORDER BY (p.status = 'afgerond') ASC, p.created_at DESC
    `)
    return jsonOk(projects)
  } catch (error: unknown) {
    return jsonFail('PROJECTS_LIST_FAILED', 'Kon projecten niet ophalen', 500, error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, status, color } = body

    if (!title?.trim()) return jsonFail('PROJECT_VALIDATION', 'Titel is verplicht', 400, undefined, req)

    const project = await queryOne(`
      INSERT INTO projects (title, description, status, color) VALUES ($1, $2, $3, $4) RETURNING *
    `, [title.trim(), description || null, status || 'actief', color || '#6172f3'])

    if (project && 'id' in project) {
      await logActivity({
        entityType: 'project',
        entityId: Number(project.id),
        action: 'created',
        title: String(project.title || title),
        summary: 'Project aangemaakt',
        metadata: { status: status || 'actief' },
      })
    }

    return jsonOk(project, { status: 201 }, req)
  } catch (error: unknown) {
    return jsonFail('PROJECT_CREATE_FAILED', 'Kon project niet aanmaken', 500, error, req)
  }
}
