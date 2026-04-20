export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const filter = searchParams.get('filter')
    const projectId = searchParams.get('project_id')
    const category = searchParams.get('category')
    const completed = searchParams.get('completed')

    const conditions: string[] = []
    const params: unknown[] = []
    let i = 1

    if (completed === '1') {
      conditions.push('t.completed = 1')
    } else {
      conditions.push('t.completed = 0')
    }

    if (filter === 'today' || filter === 'vandaag') {
      conditions.push('t.due_date::date = CURRENT_DATE')
    } else if (filter === 'week' || filter === 'deze week') {
      conditions.push(`t.due_date::date <= CURRENT_DATE + INTERVAL '7 days'`)
    } else if (filter === 'overdue' || filter === 'te laat') {
      conditions.push('t.due_date::date < CURRENT_DATE AND t.completed = 0')
    }

    if (projectId) { conditions.push(`t.project_id = $${i++}`); params.push(parseInt(projectId)) }
    if (category) { conditions.push(`t.category = $${i++}`); params.push(category) }

    const sql = `
      SELECT t.*, p.title as project_title, p.color as project_color
      FROM todos t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY CASE t.priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.due_date ASC NULLS LAST
    `
    const todos = await query(sql, params)
    return jsonOk(todos, undefined, req)
  } catch (error: unknown) {
    return jsonFail('TODO_LIST_FAILED', 'Kon todos niet ophalen', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, category, priority, due_date, project_id, contact_id, recurring } = body
    if (!title?.trim()) return jsonFail('TODO_VALIDATION', 'Titel is verplicht', 400, undefined, req)
    const todo = await queryOne(
      `INSERT INTO todos (title, description, category, priority, due_date, project_id, contact_id, recurring)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title.trim(), description || null, category || 'overig', priority || 'medium', due_date || null, project_id || null, contact_id || null, recurring || null]
    )
    if ((todo as Record<string, unknown> | undefined)?.id) {
      await syncEntityLinks({
        sourceType: 'todo',
        sourceId: Number((todo as Record<string, unknown>).id),
        projectId: project_id || null,
        contactId: contact_id || null,
        tags: category ? [category] : [],
      })
      await logActivity({
        entityType: 'todo',
        entityId: Number((todo as Record<string, unknown>).id),
        action: 'created',
        title: title.trim(),
        summary: 'Todo aangemaakt',
        metadata: { priority: priority || 'medium', due_date: due_date || null },
      })
    }
    return jsonOk(todo, { status: 201 }, req)
  } catch (error: unknown) {
    return jsonFail('TODO_CREATE_FAILED', 'Kon todo niet aanmaken', 500, error, req)
  }
}
