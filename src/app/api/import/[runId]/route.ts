export const dynamic = 'force-dynamic'

/**
 * GET /api/import/[runId]
 * Haal status + kandidaten van een import run op.
 *
 * POST /api/import/[runId]
 * Trigger segmentatie + matching voor deze run.
 * Body: { action: 'segment' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { runSegmentation } from '@/lib/import/segmentation-engine'
import { runMatching } from '@/lib/import/matching-engine'

type RouteParams = { params: { runId: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const runId = parseInt(params.runId)
  if (isNaN(runId)) return NextResponse.json({ error: 'Ongeldig runId' }, { status: 400 })

  const run = await queryOne<{
    id: number
    source_label: string
    source_type: string
    status: string
    total_candidates: number | null
    accepted_count: number | null
    created_at: string
    completed_at: string | null
  }>(
    `SELECT id, source_label, source_type, status, total_candidates, accepted_count, created_at, completed_at
     FROM import_runs WHERE id = $1`,
    [runId]
  )

  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  const candidateCounts = await query<{ review_status: string; count: string }>(
    `SELECT review_status, COUNT(*) as count FROM import_candidates
     WHERE import_run_id = $1 GROUP BY review_status`,
    [runId]
  ).catch(() => [])

  const counts = Object.fromEntries(candidateCounts.map(r => [r.review_status, parseInt(r.count)]))

  const followUps = await query<{ question: string }>(
    `SELECT question FROM import_followups WHERE import_run_id = $1`,
    [runId]
  ).catch(() => [])

  return NextResponse.json({
    run,
    candidateCounts: counts,
    followUpQuestions: followUps.map(f => f.question),
  })
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const runId = parseInt(params.runId)
  if (isNaN(runId)) return NextResponse.json({ error: 'Ongeldig runId' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action as string | undefined

  if (action !== 'segment') {
    return NextResponse.json({ error: 'action moet "segment" zijn' }, { status: 400 })
  }

  const run = await queryOne<{ status: string }>(
    'SELECT status FROM import_runs WHERE id = $1',
    [runId]
  )
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  if (!['pending', 'review'].includes(run.status)) {
    return NextResponse.json({ error: `Run heeft status "${run.status}" en kan niet opnieuw gesegmenteerd worden` }, { status: 409 })
  }

  // Run segmentation (may take ~10-30s for large inputs)
  const segResult = await runSegmentation(runId)
  const matchCount = await runMatching(runId)

  return NextResponse.json({
    candidateCount: segResult.candidateCount,
    followUpCount: segResult.followUpCount,
    matchCount,
  })
}
