export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let sql = `
    SELECT e.*,
      TO_CHAR(e.date, 'YYYY-MM-DD') as date,
      p.title as project_title, p.color as project_color,
      c.name as contact_name
    FROM events e
    LEFT JOIN projects p ON e.project_id = p.id
    LEFT JOIN contacts c ON e.contact_id = c.id
    WHERE (1=1`
  const params: unknown[] = []
  let i = 1

  if (date) {
    sql += ` AND (e.date = $${i++} OR e.recurring IS NOT NULL)`
    params.push(date)
  } else if (from && to) {
    sql += ` AND (e.date BETWEEN $${i++} AND $${i++} OR e.recurring IS NOT NULL)`
    params.push(from, to)
  } else {
    sql += ` AND (e.date >= CURRENT_DATE AND e.date <= CURRENT_DATE + INTERVAL '30 days' OR e.recurring IS NOT NULL)`
  }

  sql += `) ORDER BY e.date ASC, e.time ASC NULLS LAST`

  const events = await query<any>(sql, params)
  const startRange = date ? new Date(date) : from ? new Date(from) : new Date()
  const endRange = date
    ? new Date(date)
    : to
      ? new Date(to)
      : new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)

  const expanded: any[] = []

  events.forEach((event) => {
    if (!event.recurring) {
      expanded.push(event)
      return
    }

    const originalDate = new Date(event.date)
    if (originalDate >= startRange && originalDate <= endRange) {
      expanded.push(event)
    }

    let current = new Date(originalDate)
    let safety = 0

    while (safety < 365) {
      safety += 1
      if (event.recurring === 'dagelijks') current.setDate(current.getDate() + 1)
      else if (event.recurring === 'wekelijks') current.setDate(current.getDate() + 7)
      else if (event.recurring === 'maandelijks') current.setMonth(current.getMonth() + 1)
      else break

      if (current > endRange) break
      if (current >= startRange) {
        expanded.push({
          ...event,
          date: current.toISOString().split('T')[0],
          is_occurrence: true,
        })
      }
    }
  })

  return NextResponse.json({ data: expanded })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, date, time, duration = 60, type = 'algemeen', project_id, contact_id, all_day = false, recurring = null } = body

  if (!title?.trim() || !date) {
    return NextResponse.json({ error: 'title en date zijn verplicht' }, { status: 400 })
  }

  const event = await queryOne(
    `
    INSERT INTO events (title, description, date, time, duration, type, project_id, contact_id, all_day, recurring)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
  `,
    [title.trim(), description ?? null, date, time ?? null, duration, type, project_id ?? null, contact_id ?? null, all_day ? 1 : 0, recurring]
  )

  if (event && 'id' in event) {
    await syncEntityLinks({
      sourceType: 'event',
      sourceId: Number(event.id),
      projectId: project_id ?? null,
      contactId: contact_id ?? null,
      tags: [type],
    })
    await logActivity({
      entityType: 'event',
      entityId: Number(event.id),
      action: 'created',
      title: title.trim(),
      summary: 'Agenda-item aangemaakt',
      metadata: { date, time: time ?? null, type },
    })
  }

  return NextResponse.json({ data: event }, { status: 201 })
}
