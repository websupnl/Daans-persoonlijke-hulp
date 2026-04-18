export const dynamic = 'force-dynamic'

/**
 * GET /api/import/[runId]/candidates
 * Geeft kandidaten terug, optioneel gefilterd op type of status.
 * Query params: ?type=project,memory&status=pending
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

type RouteParams = { params: { runId: string } }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const runId = parseInt(params.runId)
  if (isNaN(runId)) return NextResponse.json({ error: 'Ongeldig runId' }, { status: 400 })

  const { searchParams } = req.nextUrl
  const typeFilter = searchParams.get('type')?.split(',').filter(Boolean) ?? []
  const statusFilter = searchParams.get('status')?.split(',').filter(Boolean) ?? ['pending']

  const conditions: string[] = ['import_run_id = $1']
  const args: unknown[] = [runId]
  let idx = 2

  if (statusFilter.length > 0) {
    conditions.push(`review_status = ANY($${idx++})`)
    args.push(statusFilter)
  }
  if (typeFilter.length > 0) {
    conditions.push(`candidate_type = ANY($${idx++})`)
    args.push(typeFilter)
  }

  const candidates = await query<{
    id: number
    candidate_type: string
    target_module: string
    suggested_title: string | null
    normalized_text: string
    confidence: number
    temporal_context: string
    ai_reasoning: string
    suggested_action: string
    review_status: string
    matched_entity_type: string | null
    matched_entity_id: number | null
    match_confidence: number | null
    match_reasoning: string | null
    created_entity_id: number | null
    source_position: number
  }>(
    `SELECT id, candidate_type, target_module, suggested_title, normalized_text,
            confidence, temporal_context, ai_reasoning, suggested_action, review_status,
            matched_entity_type, matched_entity_id, match_confidence, match_reasoning,
            created_entity_id, source_position
     FROM import_candidates
     WHERE ${conditions.join(' AND ')}
     ORDER BY source_position ASC`,
    args
  ).catch(() => [])

  return NextResponse.json({ candidates, total: candidates.length })
}
