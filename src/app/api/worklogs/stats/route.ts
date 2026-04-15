export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
  const period = req.nextUrl.searchParams.get('period') || 'week'

  let dateFilter: string
  switch (period) {
    case 'today':
      dateFilter = "date(w.start_time) = date('now')"
      break
    case 'month':
      dateFilter = "date(w.start_time) >= date('now', '-30 days')"
      break
    default:
      dateFilter = "date(w.start_time) >= date('now', '-7 days')"
  }

  const [totalResult, categoryResult, typeResult, deviationResult, daysResult] = await Promise.all([
    db.execute({
      sql: `SELECT
        COALESCE(ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1), 0) as total_hours,
        COUNT(*) as total_logs,
        COALESCE(ROUND(AVG(COALESCE(actual_duration_minutes, duration_minutes, 0)), 0), 0) as avg_duration_minutes
        FROM worklogs w WHERE ${dateFilter}`,
      args: [],
    }),
    db.execute({
      sql: `SELECT category,
        ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1) as hours,
        COUNT(*) as count
        FROM worklogs w WHERE ${dateFilter} GROUP BY category ORDER BY hours DESC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT type,
        COUNT(*) as count,
        ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1) as hours
        FROM worklogs w WHERE ${dateFilter} GROUP BY type ORDER BY hours DESC`,
      args: [],
    }),
    db.execute({
      sql: `SELECT
        COALESCE(ROUND(AVG(CAST(actual_duration_minutes AS REAL) - CAST(expected_duration_minutes AS REAL)), 0), 0) as avg_deviation,
        COUNT(CASE WHEN actual_duration_minutes > expected_duration_minutes THEN 1 END) as over_count,
        COUNT(*) as total_with_both
        FROM worklogs w
        WHERE ${dateFilter} AND expected_duration_minutes IS NOT NULL AND actual_duration_minutes IS NOT NULL`,
      args: [],
    }),
    db.execute({
      sql: `SELECT
        date(w.start_time) as day,
        ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1) as hours,
        COUNT(*) as log_count,
        GROUP_CONCAT(DISTINCT w.category) as categories
        FROM worklogs w WHERE ${dateFilter}
        GROUP BY date(w.start_time) ORDER BY day DESC`,
      args: [],
    }),
  ])

  const totalRow = totalResult.rows[0]
  const totalHours = Number(totalRow?.[0] || 0)
  const totalLogs = Number(totalRow?.[1] || 0)
  const avgDuration = Number(totalRow?.[2] || 0)

  const categories = toRows(categoryResult)
  const types = toRows(typeResult)
  const days = toRows(daysResult)

  const devRow = deviationResult.rows[0]
  const avgDeviation = Number(devRow?.[0] || 0)
  const overCount = Number(devRow?.[1] || 0)
  const totalWithBoth = Number(devRow?.[2] || 0)

  // Count logs with interruptions from recent data
  const interruptedLogs = toRows(await db.execute({
    sql: `SELECT COUNT(*) as c FROM worklogs w WHERE ${dateFilter} AND interruptions IS NOT NULL AND interruptions != ''`,
    args: [],
  }))
  const interruptedCount = Number(interruptedLogs[0]?.c || 0)
  const interruptedRatio = totalLogs > 0 ? interruptedCount / totalLogs : 0

  // ── Focus score ─────────────────────────────────────────────────────────────
  // 70 base, +20 if avg block ≥90m, +10 if ≥60m, -15 if <30m
  // -15 if >50% interrupted, -5 for too many small logs
  let focusScore = 70
  if (avgDuration >= 90) focusScore += 20
  else if (avgDuration >= 60) focusScore += 10
  else if (avgDuration > 0 && avgDuration < 30) focusScore -= 15
  if (interruptedRatio > 0.5) focusScore -= 15
  else if (interruptedRatio > 0.3) focusScore -= 8
  if (totalLogs > 10) focusScore -= 5
  focusScore = Math.max(0, Math.min(100, focusScore))

  // ── Detections ───────────────────────────────────────────────────────────────
  const detections: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = []

  if (totalWithBoth > 2 && avgDeviation > 30) {
    detections.push({
      type: 'warning',
      message: `Structureel onderschatten: gemiddeld ${Math.round(avgDeviation)} min te lang bezig (${overCount}× te lang)`,
    })
  }
  if (interruptedRatio > 0.4) {
    detections.push({
      type: 'warning',
      message: `Veel onderbrekingen: ${interruptedCount} van ${totalLogs} sessies onderbroken`,
    })
  }
  if (period === 'today' && totalHours > 10) {
    detections.push({
      type: 'error',
      message: `Overwerken gedetecteerd: ${totalHours}u vandaag — pas op!`,
    })
  }
  if (period === 'today' && totalLogs === 0) {
    detections.push({
      type: 'info',
      message: 'Nog geen logs vandaag — vergeet je tijd bij te houden?',
    })
  }

  return NextResponse.json({
    data: {
      period,
      total_hours: totalHours,
      total_logs: totalLogs,
      avg_duration_minutes: avgDuration,
      focus_score: focusScore,
      category_breakdown: categories,
      type_breakdown: types,
      avg_deviation_minutes: Math.round(avgDeviation),
      over_estimate_count: overCount,
      interrupted_count: interruptedCount,
      days,
      detections,
    },
  })
}
