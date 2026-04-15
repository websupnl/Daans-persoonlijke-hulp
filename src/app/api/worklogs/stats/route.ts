export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period') ?? 'week'

  let dateFilter: string
  switch (period) {
    case 'today': dateFilter = `date = CURRENT_DATE`; break
    case 'month': dateFilter = `date >= CURRENT_DATE - INTERVAL '30 days'`; break
    default:      dateFilter = `date >= CURRENT_DATE - INTERVAL '7 days'`
  }

  const [totalRow, categoryRows, dayRows] = await Promise.all([
    queryOne<{ total_hours: number; total_logs: number; avg_duration: number }>(`
      SELECT
        ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1) as total_hours,
        COUNT(*) as total_logs,
        ROUND(AVG(COALESCE(actual_duration_minutes, duration_minutes, 0))) as avg_duration
      FROM work_logs WHERE ${dateFilter}
    `),
    query<{ context: string; hours: number; count: number }>(`
      SELECT context,
        ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1) as hours,
        COUNT(*) as count
      FROM work_logs WHERE ${dateFilter}
      GROUP BY context ORDER BY hours DESC
    `),
    query<{ day: string; hours: number; log_count: number }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as day,
        ROUND(SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) / 60.0, 1) as hours,
        COUNT(*) as log_count
      FROM work_logs WHERE ${dateFilter}
      GROUP BY date ORDER BY date DESC
    `),
  ])

  const totalHours = Number(totalRow?.total_hours ?? 0)
  const totalLogs = Number(totalRow?.total_logs ?? 0)
  const avgDuration = Number(totalRow?.avg_duration ?? 0)

  // Focus score
  let focusScore = 70
  if (avgDuration >= 90) focusScore += 20
  else if (avgDuration >= 60) focusScore += 10
  else if (avgDuration > 0 && avgDuration < 30) focusScore -= 15
  if (totalLogs > 10) focusScore -= 5
  focusScore = Math.max(0, Math.min(100, focusScore))

  // Detections
  const detections: Array<{ type: 'warning' | 'error' | 'info'; message: string }> = []

  const deviationRow = await queryOne<{ avg_deviation: number; over_count: number; total_with_both: number }>(`
    SELECT
      ROUND(AVG(actual_duration_minutes - expected_duration_minutes)) as avg_deviation,
      COUNT(CASE WHEN actual_duration_minutes > expected_duration_minutes THEN 1 END) as over_count,
      COUNT(*) as total_with_both
    FROM work_logs
    WHERE ${dateFilter} AND expected_duration_minutes IS NOT NULL AND actual_duration_minutes IS NOT NULL
  `)

  const interruptedRow = await queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM work_logs
    WHERE ${dateFilter} AND interruptions IS NOT NULL AND interruptions != ''
  `)

  const avgDeviation = Number(deviationRow?.avg_deviation ?? 0)
  const totalWithBoth = Number(deviationRow?.total_with_both ?? 0)
  const interruptedCount = Number(interruptedRow?.count ?? 0)
  const interruptedRatio = totalLogs > 0 ? interruptedCount / totalLogs : 0

  if (totalWithBoth > 2 && avgDeviation > 30) {
    detections.push({ type: 'warning', message: `Structureel onderschatten: gem. ${Math.round(avgDeviation)} min te lang` })
  }
  if (interruptedRatio > 0.4) {
    detections.push({ type: 'warning', message: `Veel onderbrekingen: ${interruptedCount} van ${totalLogs} sessies` })
  }
  if (period === 'today' && totalHours > 10) {
    detections.push({ type: 'error', message: `Overwerken: ${totalHours}u vandaag` })
  }
  if (period === 'today' && totalLogs === 0) {
    detections.push({ type: 'info', message: 'Nog geen logs vandaag' })
  }

  return NextResponse.json({
    data: { period, total_hours: totalHours, total_logs: totalLogs, avg_duration_minutes: avgDuration, focus_score: focusScore, category_breakdown: categoryRows, days: dayRows, avg_deviation_minutes: Math.round(avgDeviation), interrupted_count: interruptedCount, detections },
  })
}
