export const dynamic = 'force-dynamic'

/**
 * PATCH /api/import/[runId]/candidates/[id]
 * Update review beslissing op een kandidaat.
 *
 * Body:
 *   { action: 'accept' | 'reject' | 'reset' }
 *   optioneel: { suggested_action?: 'create' | 'merge' | 'update' }
 *
 * Bij 'accept' wordt de kandidaat direct geëxecuteerd.
 */

import { NextRequest, NextResponse } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { executeSingleCandidate } from '@/lib/import/execution-engine'

type RouteParams = { params: { runId: string; id: string } }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const runId = parseInt(params.runId)
  const candidateId = parseInt(params.id)
  if (isNaN(runId) || isNaN(candidateId)) {
    return NextResponse.json({ error: 'Ongeldig runId of id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const action = body?.action as string | undefined
  if (!['accept', 'reject', 'reset'].includes(action ?? '')) {
    return NextResponse.json({ error: 'action moet accept, reject of reset zijn' }, { status: 400 })
  }

  // Verify candidate belongs to this run
  const candidate = await queryOne<{ id: number; review_status: string }>(
    'SELECT id, review_status FROM import_candidates WHERE id = $1 AND import_run_id = $2',
    [candidateId, runId]
  )
  if (!candidate) return NextResponse.json({ error: 'Kandidaat niet gevonden' }, { status: 404 })

  if (action === 'reject') {
    await execute(
      `UPDATE import_candidates SET review_status = 'rejected' WHERE id = $1`,
      [candidateId]
    )
    return NextResponse.json({ success: true, status: 'rejected' })
  }

  if (action === 'reset') {
    await execute(
      `UPDATE import_candidates SET review_status = 'pending', created_entity_id = NULL WHERE id = $1`,
      [candidateId]
    )
    return NextResponse.json({ success: true, status: 'pending' })
  }

  // action === 'accept': optionally update suggested_action first
  if (body?.suggested_action) {
    await execute(
      `UPDATE import_candidates SET suggested_action = $2 WHERE id = $1`,
      [candidateId, body.suggested_action]
    )
  }

  // Mark as accepted so execution engine picks it up
  await execute(
    `UPDATE import_candidates SET review_status = 'accepted' WHERE id = $1`,
    [candidateId]
  )

  // Execute immediately
  const result = await executeSingleCandidate(candidateId)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, entityId: result.entityId, entityType: result.entityType })
}
