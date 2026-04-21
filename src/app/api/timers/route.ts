export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { logActivity } from '@/lib/activity'

const amsterdamTime = new Intl.DateTimeFormat('nl-NL', {
  timeZone: 'Europe/Amsterdam',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const amsterdamDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export async function GET() {
  const timer = await queryOne<{ id: number; title: string; project_id: number | null; project_title: string | null; context: string; started_at: string }>(`
    SELECT at.id, at.title, at.project_id, p.title as project_title, at.context, at.started_at
    FROM active_timers at
    LEFT JOIN projects p ON p.id = at.project_id
    ORDER BY at.started_at DESC LIMIT 1
  `).catch(() => undefined)

  if (!timer) return NextResponse.json({ timer: null })

  const elapsed_minutes = Math.round((Date.now() - new Date(timer.started_at).getTime()) / 60000)
  return NextResponse.json({ timer: { ...timer, elapsed_minutes } })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'start') {
    const { title, context = 'overig', project_id } = body
    if (!title) return NextResponse.json({ error: 'title verplicht' }, { status: 400 })
    await execute('DELETE FROM active_timers', [])
    const row = await queryOne<{ id: number }>(`
      INSERT INTO active_timers (title, project_id, context, source)
      VALUES ($1, $2, $3, 'web') RETURNING id
    `, [title, project_id ?? null, context])
    await logActivity({ entityType: 'timer', entityId: row?.id, action: 'started', title, summary: `Timer gestart: ${title}` })
    return NextResponse.json({ id: row?.id, title, started_at: new Date().toISOString() })
  }

  if (action === 'stop') {
    const timer = await queryOne<{ id: number; title: string; project_id: number | null; context: string; started_at: string }>(`
      SELECT id, title, project_id, context, started_at FROM active_timers ORDER BY started_at DESC LIMIT 1
    `)
    if (!timer) return NextResponse.json({ error: 'Geen actieve timer' }, { status: 404 })
    const elapsed = Math.max(1, Math.round((Date.now() - new Date(timer.started_at).getTime()) / 60000))
    const startedAt = new Date(timer.started_at)
    const stoppedAt = new Date()
    const startTime = amsterdamTime.format(startedAt)
    const endTime = amsterdamTime.format(stoppedAt)
    const date = amsterdamDate.format(stoppedAt)
    await execute('DELETE FROM active_timers', [])
    const row = await queryOne<{ id: number }>(`
      INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, start_time, end_time, date, context, project_id, source)
      VALUES ($1, $2, $2, $3, $4, $5, $6, $7, 'timer') RETURNING id
    `, [timer.title, elapsed, startTime, endTime, date, timer.context, timer.project_id ?? null])
    await logActivity({ entityType: 'worklog', entityId: row?.id, action: 'created', title: timer.title, summary: `Timer gestopt na ${elapsed} minuten` })
    return NextResponse.json({ worklog_id: row?.id, title: timer.title, duration_minutes: elapsed })
  }

  if (action === 'cancel') {
    await execute('DELETE FROM active_timers', [])
    return NextResponse.json({ cancelled: true })
  }

  return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
}
