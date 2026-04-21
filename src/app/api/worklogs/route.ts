export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const context = searchParams.get('context')
    const projectId = searchParams.get('project_id')
    const limit = parseInt(searchParams.get('limit') ?? '20')

    let sql = `SELECT w.*, p.title as project_title FROM work_logs w LEFT JOIN projects p ON w.project_id = p.id WHERE 1=1`
    const params: unknown[] = []
    let i = 1

    if (date) { sql += ` AND w.date = $${i++}`; params.push(date) }
    if (context) { sql += ` AND w.context = $${i++}`; params.push(context) }
    if (projectId) { sql += ` AND w.project_id = $${i++}`; params.push(parseInt(projectId)) }

    sql += ` ORDER BY w.date DESC, w.created_at DESC LIMIT $${i++}`
    params.push(limit)

    const logs = await query(sql, params)

    const stats = await query(`
    SELECT context, SUM(COALESCE(actual_duration_minutes, duration_minutes)) as total_minutes, COUNT(*) as count
    FROM work_logs GROUP BY context ORDER BY total_minutes DESC
  `)

    const todayStats = await queryOne<{ today_minutes: number }>(`
    SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as today_minutes FROM work_logs WHERE date = CURRENT_DATE
  `)

    const weekStats = await queryOne<{ week_minutes: number }>(`
    SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as week_minutes FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL '7 days'
  `)

    return jsonOk({ logs, stats, todayStats, weekStats }, undefined, request)
  } catch (error: unknown) {
    return jsonFail('WORKLOGS_LIST_FAILED', 'Kon werklogs niet ophalen', 500, error, request)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
  const {
    title,
    duration_minutes,
    actual_duration_minutes,
    expected_duration_minutes,
    start_time,
    end_time,
    context,
    date,
    description,
    project_id,
    energy_level,
    source,
    category,
    type,
    interruptions,
    billable,
    hourly_rate,
  } = body

    if (!title || !duration_minutes || !context) {
      return jsonFail('WORKLOG_VALIDATION', 'title, duration_minutes en context zijn verplicht', 400, undefined, request)
    }

    const log = await queryOne(`
    INSERT INTO work_logs (
      title, duration_minutes, actual_duration_minutes, expected_duration_minutes, start_time, end_time, context,
      date, description, project_id, energy_level, source, category, type, interruptions, billable, hourly_rate
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
  `, [
    title,
    duration_minutes,
    actual_duration_minutes ?? null,
    expected_duration_minutes ?? null,
    start_time ?? null,
    end_time ?? null,
    context,
    date ?? new Date().toISOString().split('T')[0],
    description ?? null,
    project_id ?? null,
    energy_level ?? null,
    source ?? 'manual',
    category ?? 'business',
    type ?? 'deep_work',
    interruptions ?? null,
    billable ? 1 : 0,
    hourly_rate ?? null,
  ])

    if (log && 'id' in log) {
      await syncEntityLinks({
        sourceType: 'worklog',
        sourceId: Number(log.id),
        projectId: project_id ?? null,
        tags: [context, type ?? 'deep_work'],
      })
      await logActivity({
        entityType: 'worklog',
        entityId: Number(log.id),
        action: 'created',
        title: String(title),
        summary: 'Werklog opgeslagen',
        metadata: { context, duration_minutes, start_time: start_time ?? null, end_time: end_time ?? null, source: source ?? 'manual' },
      })
    }

    return jsonOk({ log }, { status: 201 }, request)
  } catch (error: unknown) {
    return jsonFail('WORKLOG_CREATE_FAILED', 'Kon werklog niet opslaan', 500, error, request)
  }
}
