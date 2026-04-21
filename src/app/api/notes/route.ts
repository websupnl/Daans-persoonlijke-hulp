export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { generateTags, rankNotesByQuery } from '@/lib/ai/note-utils'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'
import { ensureWorkspaceColumns, getWorkspaceFromRequest } from '@/lib/workspace'

export async function GET(req: NextRequest) {
  try {
    await ensureWorkspaceColumns(['notes'])
    const workspace = getWorkspaceFromRequest(req)
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const smart = searchParams.get('smart') === 'true'
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
        WHERE n.workspace = $${i++} AND (n.title ILIKE $${i} OR n.content_text ILIKE $${i})
        ORDER BY n.pinned DESC, n.updated_at DESC
      `
      params.push(workspace, `%${search}%`)
    } else {
      sql = `
        SELECT n.*, p.title as project_title, p.color as project_color, c.name as contact_name
        FROM notes n
        LEFT JOIN projects p ON n.project_id = p.id
        LEFT JOIN contacts c ON n.contact_id = c.id
        WHERE n.workspace = $${i++}
      `
      params.push(workspace)
      if (projectId) {
        sql += ` AND n.project_id = $${i++}`
        params.push(parseInt(projectId))
      }
      if (tag) {
        sql += ` AND n.tags LIKE $${i++}`
        params.push(`%"${tag}"%`)
      }
      sql += ' ORDER BY n.pinned DESC, n.updated_at DESC'
    }

    let notes = (await query<Record<string, unknown>>(sql, params)).map((n) => ({
      ...n,
      tags: JSON.parse(n.tags as string || '[]'),
      content: n.content,
    }))

    if (smart && search) {
      notes = await rankNotesByQuery(notes, search)
    }

    return jsonOk(notes, undefined, req)
  } catch (error: unknown) {
    return jsonFail('NOTES_LIST_FAILED', 'Kon notities niet ophalen', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureWorkspaceColumns(['notes'])
    const workspace = getWorkspaceFromRequest(req)
    const body = await req.json()
    let { title, content, content_text, tags, project_id, contact_id, pinned } = body

    if ((!tags || tags.length === 0) && content_text) {
      try {
        const aiTags = await generateTags(content_text)
        if (aiTags.length > 0) tags = aiTags
      } catch (error) {
        console.warn('[/api/notes] AI-tagging overgeslagen:', error)
      }
    }

    const note = await queryOne<Record<string, unknown>>(`
      INSERT INTO notes (title, content, content_text, tags, project_id, contact_id, pinned, workspace)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      title || 'Naamloze note',
      content || '',
      content_text || '',
      JSON.stringify(tags || []),
      project_id || null,
      contact_id || null,
      pinned ? 1 : 0,
      workspace,
    ])

    if (note?.id) {
      await syncEntityLinks({
        sourceType: 'note',
        sourceId: Number(note.id),
        projectId: project_id || null,
        contactId: contact_id || null,
        tags: tags || [],
      })
      await logActivity({
        entityType: 'note',
        entityId: Number(note.id),
        action: 'created',
        title: String(note.title || title || 'Naamloze note'),
        summary: 'Note opgeslagen',
        metadata: { project_id: project_id || null, contact_id: contact_id || null },
      })
    }

    return jsonOk({ ...note, tags: JSON.parse(note?.tags as string || '[]') }, { status: 201 }, req)
  } catch (error: unknown) {
    return jsonFail('NOTE_CREATE_FAILED', 'Kon notitie niet opslaan', 500, error, req)
  }
}
