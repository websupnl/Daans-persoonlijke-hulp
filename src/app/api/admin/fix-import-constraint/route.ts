export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { execute, query } from '@/lib/db'

export async function POST() {
  // Check current constraint definition
  const constraints = await query<{ constraint_name: string; check_clause: string }>(
    `SELECT constraint_name, check_clause
     FROM information_schema.check_constraints
     WHERE constraint_name LIKE '%import_runs%'`
  ).catch(() => [])

  // Drop old constraint and recreate with all needed statuses
  await execute(
    `ALTER TABLE import_runs
     DROP CONSTRAINT IF EXISTS import_runs_status_check`
  )

  await execute(
    `ALTER TABLE import_runs
     ADD CONSTRAINT import_runs_status_check
     CHECK (status IN ('pending','new','segmenting','matching','review','executing','done','error','cancelled'))`
  )

  return NextResponse.json({ ok: true, previous_constraints: constraints })
}
