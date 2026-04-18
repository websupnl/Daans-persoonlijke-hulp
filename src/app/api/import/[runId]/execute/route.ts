export const dynamic = 'force-dynamic'

/**
 * POST /api/import/[runId]/execute
 * Voer alle geaccepteerde kandidaten uit in één keer.
 * Optioneel: { acceptAll: true } → accepteer alle pending kandidaten eerst.
 */

import { NextRequest, NextResponse } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { runExecution } from '@/lib/import/execution-engine'

type RouteParams = { params: { runId: string } }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const runId = parseInt(params.runId)
  if (isNaN(runId)) return NextResponse.json({ error: 'Ongeldig runId' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const acceptAll = body?.acceptAll === true

  const run = await queryOne<{ status: string }>(
    'SELECT status FROM import_runs WHERE id = $1',
    [runId]
  )
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  if (run.status === 'executing') {
    return NextResponse.json({ error: 'Run wordt al uitgevoerd' }, { status: 409 })
  }
  if (run.status === 'completed') {
    return NextResponse.json({ error: 'Run is al afgerond' }, { status: 409 })
  }

  // Optionally accept all pending candidates
  if (acceptAll) {
    await execute(
      `UPDATE import_candidates SET review_status = 'accepted'
       WHERE import_run_id = $1 AND review_status = 'pending'`,
      [runId]
    )
  }

  const result = await runExecution(runId)

  return NextResponse.json(result)
}
