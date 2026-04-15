export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { findLinkedEntityIds } from '@/lib/activity'

function toIds(rows: Array<{ source_type: string; source_id: number }>, sourceType: string): number[] {
  return rows.filter((row) => row.source_type === sourceType).map((row) => row.source_id)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = String(searchParams.get('q') || '').trim()

  if (!q) {
    return NextResponse.json({
      data: {
        todos: [],
        notes: [],
        contacts: [],
        projects: [],
        ideas: [],
        worklogs: [],
        events: [],
        finance: [],
        memories: [],
        chats: [],
      },
    })
  }

  const companyLinks = await findLinkedEntityIds('company', q)
  const tagLinks = await findLinkedEntityIds('tag', q)

  const noteLinkIds = Array.from(new Set([...toIds(companyLinks, 'note'), ...toIds(tagLinks, 'note')]))
  const todoLinkIds = Array.from(new Set([...toIds(companyLinks, 'todo'), ...toIds(tagLinks, 'todo')]))
  const financeLinkIds = Array.from(new Set([...toIds(companyLinks, 'finance'), ...toIds(tagLinks, 'finance')]))
  const ideaLinkIds = Array.from(new Set([...toIds(companyLinks, 'idea'), ...toIds(tagLinks, 'idea')]))

  const [
    todos,
    notes,
    contacts,
    projects,
    ideas,
    worklogs,
    events,
    finance,
    memories,
    chats,
  ] = await Promise.all([
    query(`
      SELECT id, title, priority, due_date, project_id, contact_id
      FROM todos
      WHERE title ILIKE $1 OR description ILIKE $1 ${todoLinkIds.length ? `OR id = ANY($2::int[])` : ''}
      ORDER BY completed ASC, updated_at DESC
      LIMIT 12
    `, todoLinkIds.length ? [`%${q}%`, todoLinkIds] : [`%${q}%`]),
    query(`
      SELECT id, title, project_id, contact_id, updated_at
      FROM notes
      WHERE title ILIKE $1 OR content_text ILIKE $1 ${noteLinkIds.length ? `OR id = ANY($2::int[])` : ''}
      ORDER BY pinned DESC, updated_at DESC
      LIMIT 12
    `, noteLinkIds.length ? [`%${q}%`, noteLinkIds] : [`%${q}%`]),
    query(`
      SELECT id, name, company, email, phone
      FROM contacts
      WHERE name ILIKE $1 OR company ILIKE $1 OR email ILIKE $1 OR notes ILIKE $1
      ORDER BY updated_at DESC
      LIMIT 12
    `, [`%${q}%`]),
    query(`
      SELECT id, title, status, color
      FROM projects
      WHERE title ILIKE $1 OR description ILIKE $1
      ORDER BY updated_at DESC
      LIMIT 12
    `, [`%${q}%`]),
    query(`
      SELECT id, title, verdict, score, status
      FROM ideas
      WHERE title ILIKE $1 OR raw_input ILIKE $1 OR refined_summary ILIKE $1 ${ideaLinkIds.length ? `OR id = ANY($2::int[])` : ''}
      ORDER BY updated_at DESC
      LIMIT 12
    `, ideaLinkIds.length ? [`%${q}%`, ideaLinkIds] : [`%${q}%`]),
    query(`
      SELECT id, title, context, date, project_id
      FROM work_logs
      WHERE title ILIKE $1 OR description ILIKE $1 OR context ILIKE $1
      ORDER BY date DESC, updated_at DESC
      LIMIT 12
    `, [`%${q}%`]),
    query(`
      SELECT id, title, date, time, type, project_id, contact_id
      FROM events
      WHERE title ILIKE $1 OR description ILIKE $1 OR type ILIKE $1
      ORDER BY date DESC, updated_at DESC
      LIMIT 12
    `, [`%${q}%`]),
    query(`
      SELECT id, title, type, amount, category, status, project_id, contact_id
      FROM finance_items
      WHERE title ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 ${financeLinkIds.length ? `OR id = ANY($2::int[])` : ''}
      ORDER BY updated_at DESC
      LIMIT 12
    `, financeLinkIds.length ? [`%${q}%`, financeLinkIds] : [`%${q}%`]),
    query(`
      SELECT id, key, value, category, confidence
      FROM memory_log
      WHERE key ILIKE $1 OR value ILIKE $1 OR category ILIKE $1
      ORDER BY last_reinforced_at DESC
      LIMIT 12
    `, [`%${q}%`]),
    query(`
      SELECT id, role, content, created_at
      FROM chat_messages
      WHERE content ILIKE $1
      ORDER BY created_at DESC
      LIMIT 12
    `, [`%${q}%`]),
  ])

  return NextResponse.json({
    data: { todos, notes, contacts, projects, ideas, worklogs, events, finance, memories, chats },
  })
}
