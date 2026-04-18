/**
 * Import Matching Engine
 *
 * Vergelijkt import candidates met bestaande data per module.
 * Doel: voorkom duplicaten, suggereer merge/update waar relevant.
 *
 * Per type:
 * - project: fuzzy title match (normalize + substring)
 * - memory: exact key match + similar key check
 * - idea: ILIKE title match
 * - todo: ILIKE title match (alleen open todos)
 * - journal: datum-based match
 * - contact: naam match
 */

import { query, execute } from '@/lib/db'

interface MatchResult {
  entityType: string
  entityId: number
  entityTitle: string
  confidence: number
  reasoning: string
  suggestedAction: 'merge' | 'update' | 'create'
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer (same logic as execute-actions.ts)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTitle(name: string): string {
  return name.toLowerCase().replace(/[\s\-_.]+/g, '').replace(/[^a-z0-9]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-type matchers
// ─────────────────────────────────────────────────────────────────────────────

async function matchProject(title: string): Promise<MatchResult | null> {
  const projects = await query<{ id: number; title: string; status: string }>(
    `SELECT id, title, status FROM projects WHERE status != 'afgerond'`
  ).catch(() => [] as Array<{ id: number; title: string; status: string }>)

  const normalized = normalizeTitle(title)
  if (!normalized) return null

  for (const p of projects) {
    const pn = normalizeTitle(p.title)

    // Exact normalized match
    if (pn === normalized) {
      return {
        entityType: 'project',
        entityId: p.id,
        entityTitle: p.title,
        confidence: 0.98,
        reasoning: `Exacte match met project "${p.title}"`,
        suggestedAction: 'merge',
      }
    }

    // Substring match (one contains the other)
    if (normalized.length >= 3 && (pn.includes(normalized) || normalized.includes(pn))) {
      const conf = Math.min(0.85, 0.6 + (Math.min(normalized.length, pn.length) / Math.max(normalized.length, pn.length)) * 0.3)
      return {
        entityType: 'project',
        entityId: p.id,
        entityTitle: p.title,
        confidence: conf,
        reasoning: `Gedeeltelijke match: "${title}" lijkt op project "${p.title}"`,
        suggestedAction: conf >= 0.8 ? 'merge' : 'create',
      }
    }
  }

  return null
}

async function matchMemory(title: string, normalizedText: string): Promise<MatchResult | null> {
  const key = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  if (!key) return null

  // Exact key match
  const exact = await query<{ id: number; key: string; value: string }>(
    `SELECT id, key, value FROM memory_log WHERE key = $1 LIMIT 1`,
    [key]
  ).catch(() => [] as any[])

  if (exact.length > 0) {
    return {
      entityType: 'memory',
      entityId: exact[0].id,
      entityTitle: exact[0].key,
      confidence: 0.95,
      reasoning: `Memory key "${key}" bestaat al`,
      suggestedAction: 'update',
    }
  }

  // Similar key (contains)
  const similar = await query<{ id: number; key: string }>(
    `SELECT id, key FROM memory_log WHERE key ILIKE $1 OR key ILIKE $2 LIMIT 1`,
    [`%${key.slice(0, 15)}%`, `${key.slice(0, 10)}%`]
  ).catch(() => [] as any[])

  if (similar.length > 0) {
    return {
      entityType: 'memory',
      entityId: similar[0].id,
      entityTitle: similar[0].key,
      confidence: 0.65,
      reasoning: `Vergelijkbare memory key gevonden: "${similar[0].key}"`,
      suggestedAction: 'create', // show to user, they decide
    }
  }

  return null
}

async function matchIdea(title: string): Promise<MatchResult | null> {
  if (!title) return null
  const ideas = await query<{ id: number; title: string }>(
    `SELECT id, title FROM ideas WHERE title ILIKE $1 LIMIT 1`,
    [`%${title.slice(0, 30)}%`]
  ).catch(() => [] as any[])

  if (ideas.length === 0) return null

  return {
    entityType: 'idea',
    entityId: ideas[0].id,
    entityTitle: ideas[0].title,
    confidence: 0.75,
    reasoning: `Vergelijkbaar idee bestaat al: "${ideas[0].title}"`,
    suggestedAction: 'merge',
  }
}

async function matchTodo(title: string): Promise<MatchResult | null> {
  if (!title) return null
  const todos = await query<{ id: number; title: string }>(
    `SELECT id, title FROM todos WHERE completed = 0 AND title ILIKE $1 LIMIT 1`,
    [`%${title.slice(0, 30)}%`]
  ).catch(() => [] as any[])

  if (todos.length === 0) return null

  return {
    entityType: 'todo',
    entityId: todos[0].id,
    entityTitle: todos[0].title,
    confidence: 0.8,
    reasoning: `Open todo bestaat al: "${todos[0].title}"`,
    suggestedAction: 'merge',
  }
}

async function matchContact(title: string): Promise<MatchResult | null> {
  if (!title) return null
  const contacts = await query<{ id: number; name: string }>(
    `SELECT id, name FROM contacts WHERE name ILIKE $1 LIMIT 1`,
    [`%${title.slice(0, 30)}%`]
  ).catch(() => [] as any[])

  if (contacts.length === 0) return null

  return {
    entityType: 'contact',
    entityId: contacts[0].id,
    entityTitle: contacts[0].name,
    confidence: 0.85,
    reasoning: `Contact bestaat al: "${contacts[0].name}"`,
    suggestedAction: 'merge',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: run matching for all pending candidates in a run
// ─────────────────────────────────────────────────────────────────────────────

export async function runMatching(runId: number): Promise<number> {
  const candidates = await query<{
    id: number
    candidate_type: string
    suggested_title: string | null
    normalized_text: string
  }>(
    `SELECT id, candidate_type, suggested_title, normalized_text
     FROM import_candidates
     WHERE import_run_id = $1 AND review_status = 'pending'`,
    [runId]
  ).catch(() => [] as any[])

  let matchCount = 0

  for (const candidate of candidates) {
    const title = candidate.suggested_title ?? candidate.normalized_text.split('\n')[0].slice(0, 60)
    let match: MatchResult | null = null

    switch (candidate.candidate_type) {
      case 'project':
        match = await matchProject(title)
        break
      case 'memory':
        match = await matchMemory(title, candidate.normalized_text)
        break
      case 'idea':
        match = await matchIdea(title)
        break
      case 'todo':
        match = await matchTodo(title)
        break
      case 'contact':
        match = await matchContact(title)
        break
    }

    if (match) {
      await execute(
        `UPDATE import_candidates SET
           matched_entity_type = $2,
           matched_entity_id = $3,
           match_confidence = $4,
           match_reasoning = $5,
           suggested_action = $6
         WHERE id = $1`,
        [
          candidate.id,
          match.entityType,
          match.entityId,
          match.confidence,
          match.reasoning,
          match.suggestedAction,
        ]
      )
      matchCount++
    }
  }

  console.log(`[Matching] Run ${runId}: ${matchCount}/${candidates.length} matches found`)
  return matchCount
}
