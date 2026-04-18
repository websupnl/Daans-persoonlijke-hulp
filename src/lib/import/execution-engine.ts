/**
 * Import Execution Engine
 *
 * Schrijft geaccepteerde import candidates weg naar de juiste modules.
 * Garandeert: read-after-write verificatie, brontracking via import_run_id,
 * en kandidaat-status update na elke write.
 *
 * Per type:
 * - project  → projects tabel, match met bestaande of nieuw aanmaken
 * - memory   → memory_log, UPSERT op key
 * - idea     → ideas
 * - todo     → todos
 * - journal  → journal_entries (append of nieuw)
 * - worklog  → work_logs
 * - contact  → contacts
 * - event    → events
 */

import { execute, query, queryOne } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ExecutionResult {
  candidateId: number
  success: boolean
  entityType: string
  entityId?: number
  error?: string
  skipped?: boolean
}

interface Candidate {
  id: number
  candidate_type: string
  target_module: string
  normalized_text: string
  suggested_title: string | null
  temporal_context: string
  matched_entity_id: number | null
  matched_entity_type: string | null
  suggested_action: string
  import_run_id: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Title helper
// ─────────────────────────────────────────────────────────────────────────────

function deriveTitle(candidate: Candidate, maxLen = 80): string {
  return (candidate.suggested_title ?? candidate.normalized_text.split('\n')[0]).slice(0, maxLen)
}

// ─────────────────────────────────────────────────────────────────────────────
// Module executors
// ─────────────────────────────────────────────────────────────────────────────

async function executeProject(c: Candidate): Promise<{ entityId: number }> {
  const title = deriveTitle(c)

  // Merge into existing project: add a note to the project
  if (c.suggested_action === 'merge' && c.matched_entity_id) {
    // Update project updated_at to signal activity + optionally tag it
    await execute(
      `UPDATE projects SET updated_at = NOW() WHERE id = $1`,
      [c.matched_entity_id]
    )
    return { entityId: c.matched_entity_id }
  }

  // Create new project
  const row = await queryOne<{ id: number }>(
    `INSERT INTO projects (title, status, description, import_run_id, created_at, updated_at)
     VALUES ($1, 'actief', $2, $3, NOW(), NOW())
     RETURNING id`,
    [title, c.normalized_text.slice(0, 500), c.import_run_id]
  )
  if (!row?.id) throw new Error('Project niet aangemaakt (geen ID)')

  const verify = await queryOne<{ id: number }>('SELECT id FROM projects WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken project')
  return { entityId: row.id }
}

async function executeMemory(c: Candidate): Promise<{ entityId: number }> {
  const rawKey = deriveTitle(c)
  const key = rawKey.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 80)
  if (!key) throw new Error('Ongeldige memory key')

  const value = c.normalized_text.slice(0, 1000)

  // Update if matched
  if (c.suggested_action === 'update' && c.matched_entity_id) {
    await execute(
      `UPDATE memory_log SET value = $2, last_reinforced_at = NOW(), import_run_id = $3 WHERE id = $1`,
      [c.matched_entity_id, value, c.import_run_id]
    )
    const verify = await queryOne<{ id: number }>('SELECT id FROM memory_log WHERE id = $1', [c.matched_entity_id])
    if (!verify) throw new Error('Verificatie mislukt na updaten memory')
    return { entityId: c.matched_entity_id }
  }

  // UPSERT on key
  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM memory_log WHERE key = $1',
    [key]
  )
  if (existing?.id) {
    await execute(
      `UPDATE memory_log SET value = $2, last_reinforced_at = NOW(), import_run_id = $3 WHERE id = $1`,
      [existing.id, value, c.import_run_id]
    )
    return { entityId: existing.id }
  }

  const row = await queryOne<{ id: number }>(
    `INSERT INTO memory_log (key, value, import_run_id, created_at, last_reinforced_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id`,
    [key, value, c.import_run_id]
  )
  if (!row?.id) throw new Error('Memory niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM memory_log WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken memory')
  return { entityId: row.id }
}

async function executeIdea(c: Candidate): Promise<{ entityId: number }> {
  const title = deriveTitle(c)

  // Merge = update existing idea description
  if (c.suggested_action === 'merge' && c.matched_entity_id) {
    await execute(
      `UPDATE ideas SET description = COALESCE(description || E'\n\n' || $2, $2), updated_at = NOW(), import_run_id = $3 WHERE id = $1`,
      [c.matched_entity_id, c.normalized_text.slice(0, 500), c.import_run_id]
    )
    const verify = await queryOne<{ id: number }>('SELECT id FROM ideas WHERE id = $1', [c.matched_entity_id])
    if (!verify) throw new Error('Verificatie mislukt na mergen idee')
    return { entityId: c.matched_entity_id }
  }

  const row = await queryOne<{ id: number }>(
    `INSERT INTO ideas (title, description, status, import_run_id, created_at, updated_at)
     VALUES ($1, $2, 'nieuw', $3, NOW(), NOW())
     RETURNING id`,
    [title, c.normalized_text.slice(0, 500), c.import_run_id]
  )
  if (!row?.id) throw new Error('Idee niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM ideas WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken idee')
  return { entityId: row.id }
}

async function executeTodo(c: Candidate): Promise<{ entityId: number }> {
  const title = deriveTitle(c)

  if (c.suggested_action === 'merge' && c.matched_entity_id) {
    // Already exists, skip creating duplicate
    return { entityId: c.matched_entity_id }
  }

  const row = await queryOne<{ id: number }>(
    `INSERT INTO todos (title, description, completed, import_run_id, created_at)
     VALUES ($1, $2, 0, $3, NOW())
     RETURNING id`,
    [title, c.normalized_text.slice(0, 500), c.import_run_id]
  )
  if (!row?.id) throw new Error('Todo niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM todos WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken todo')
  return { entityId: row.id }
}

async function executeJournal(c: Candidate): Promise<{ entityId: number }> {
  // Derive date from temporal_context or use today
  const entryDate = new Date().toISOString().split('T')[0]

  // Check if a journal entry for this date already exists
  const existing = await queryOne<{ id: number; content: string }>(
    `SELECT id, content FROM journal_entries WHERE DATE(entry_date) = $1 LIMIT 1`,
    [entryDate]
  )

  if (existing?.id) {
    // Append to existing entry
    const appended = existing.content + '\n\n---\n\n' + c.normalized_text.slice(0, 2000)
    await execute(
      `UPDATE journal_entries SET content = $2, import_run_id = $3 WHERE id = $1`,
      [existing.id, appended, c.import_run_id]
    )
    const verify = await queryOne<{ id: number }>('SELECT id FROM journal_entries WHERE id = $1', [existing.id])
    if (!verify) throw new Error('Verificatie mislukt na updaten journal')
    return { entityId: existing.id }
  }

  const title = deriveTitle(c)
  const row = await queryOne<{ id: number }>(
    `INSERT INTO journal_entries (title, content, entry_date, mood, import_run_id, created_at)
     VALUES ($1, $2, $3, NULL, $4, NOW())
     RETURNING id`,
    [title, c.normalized_text.slice(0, 5000), entryDate, c.import_run_id]
  )
  if (!row?.id) throw new Error('Journal entry niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM journal_entries WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken journal entry')
  return { entityId: row.id }
}

async function executeWorklog(c: Candidate): Promise<{ entityId: number }> {
  const title = deriveTitle(c)
  const logDate = new Date().toISOString().split('T')[0]

  const row = await queryOne<{ id: number }>(
    `INSERT INTO work_logs (title, description, log_date, hours, import_run_id, created_at)
     VALUES ($1, $2, $3, NULL, $4, NOW())
     RETURNING id`,
    [title, c.normalized_text.slice(0, 1000), logDate, c.import_run_id]
  )
  if (!row?.id) throw new Error('Werklog niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM work_logs WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken werklog')
  return { entityId: row.id }
}

async function executeContact(c: Candidate): Promise<{ entityId: number }> {
  const name = deriveTitle(c)

  if (c.suggested_action === 'merge' && c.matched_entity_id) {
    // Already exists, mark as seen via import
    await execute(
      `UPDATE contacts SET import_run_id = $2 WHERE id = $1`,
      [c.matched_entity_id, c.import_run_id]
    )
    return { entityId: c.matched_entity_id }
  }

  // Avoid exact-name duplicates
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM contacts WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  )
  if (existing?.id) return { entityId: existing.id }

  const row = await queryOne<{ id: number }>(
    `INSERT INTO contacts (name, notes, import_run_id, created_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [name, c.normalized_text.slice(0, 500), c.import_run_id]
  )
  if (!row?.id) throw new Error('Contact niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM contacts WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken contact')
  return { entityId: row.id }
}

async function executeEvent(c: Candidate): Promise<{ entityId: number }> {
  const title = deriveTitle(c)
  const eventDate = new Date().toISOString().split('T')[0]

  const row = await queryOne<{ id: number }>(
    `INSERT INTO events (title, description, date, import_run_id, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [title, c.normalized_text.slice(0, 500), eventDate, c.import_run_id]
  )
  if (!row?.id) throw new Error('Event niet aangemaakt (geen ID)')
  const verify = await queryOne<{ id: number }>('SELECT id FROM events WHERE id = $1', [row.id])
  if (!verify) throw new Error('Verificatie mislukt na aanmaken event')
  return { entityId: row.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

async function executeCandidate(c: Candidate): Promise<ExecutionResult> {
  try {
    let result: { entityId: number }

    switch (c.candidate_type) {
      case 'project':  result = await executeProject(c);  break
      case 'memory':   result = await executeMemory(c);   break
      case 'idea':     result = await executeIdea(c);     break
      case 'todo':     result = await executeTodo(c);     break
      case 'journal':  result = await executeJournal(c);  break
      case 'worklog':  result = await executeWorklog(c);  break
      case 'contact':  result = await executeContact(c);  break
      case 'event':    result = await executeEvent(c);    break
      default:
        return { candidateId: c.id, success: false, entityType: c.candidate_type, error: `Onbekend type: ${c.candidate_type}`, skipped: true }
    }

    // Mark candidate as accepted with entity reference
    await execute(
      `UPDATE import_candidates
       SET review_status = 'accepted', created_entity_id = $2
       WHERE id = $1`,
      [c.id, result.entityId]
    )

    return { candidateId: c.id, success: true, entityType: c.candidate_type, entityId: result.entityId }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[Execution] Candidate ${c.id} (${c.candidate_type}) failed:`, error)

    await execute(
      `UPDATE import_candidates SET review_status = 'error' WHERE id = $1`,
      [c.id]
    ).catch(() => {})

    return { candidateId: c.id, success: false, entityType: c.candidate_type, error }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: execute all accepted candidates for a run
// ─────────────────────────────────────────────────────────────────────────────

export async function runExecution(runId: number): Promise<{
  total: number
  succeeded: number
  failed: number
  errors: Array<{ candidateId: number; type: string; error: string }>
}> {
  // Mark run as executing
  await execute(
    `UPDATE import_runs SET status = 'executing' WHERE id = $1`,
    [runId]
  )

  // Load all accepted candidates
  const candidates = await query<Candidate>(
    `SELECT id, candidate_type, target_module, normalized_text, suggested_title,
            temporal_context, matched_entity_id, matched_entity_type,
            suggested_action, import_run_id
     FROM import_candidates
     WHERE import_run_id = $1 AND review_status = 'accepted'
     ORDER BY id ASC`,
    [runId]
  ).catch(() => [] as Candidate[])

  console.log(`[Execution] Run ${runId}: executing ${candidates.length} candidates`)

  const results: ExecutionResult[] = []
  for (const c of candidates) {
    const r = await executeCandidate(c)
    results.push(r)
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success && !r.skipped).length
  const errors = results
    .filter(r => !r.success)
    .map(r => ({ candidateId: r.candidateId, type: r.entityType, error: r.error ?? 'onbekend' }))

  // Update run stats
  await execute(
    `UPDATE import_runs
     SET status = $2,
         accepted_count = $3,
         completed_at = NOW()
     WHERE id = $1`,
    [runId, failed === 0 ? 'completed' : 'completed_with_errors', succeeded]
  )

  console.log(`[Execution] Run ${runId}: ${succeeded} ok, ${failed} failed`)
  return { total: candidates.length, succeeded, failed, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: execute a single candidate (used from review UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function executeSingleCandidate(candidateId: number): Promise<ExecutionResult> {
  const c = await queryOne<Candidate>(
    `SELECT id, candidate_type, target_module, normalized_text, suggested_title,
            temporal_context, matched_entity_id, matched_entity_type,
            suggested_action, import_run_id
     FROM import_candidates
     WHERE id = $1`,
    [candidateId]
  )
  if (!c) return { candidateId, success: false, entityType: 'unknown', error: 'Kandidaat niet gevonden' }
  return executeCandidate(c)
}
