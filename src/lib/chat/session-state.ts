/**
 * Conversation Session State
 *
 * Tracks per-session context between chat turns:
 * - last_domain: which module was last active
 * - last_result: structured data from last execution (for follow-up queries)
 *
 * Expires on inactivity: results are valid for 30 minutes.
 * After that, last_result is ignored and treated as a fresh start.
 */

import { queryOne, execute } from '@/lib/db'

export interface LastResult {
  domain: string
  period?: string                      // 'today' | 'week' | 'month'
  transactionIds?: number[]            // finance transaction IDs
  total?: number                       // finance total
  itemCount?: number
  summary?: string                     // text summary of last result
}

export interface SessionState {
  sessionKey: string
  lastDomain: string | null
  lastResult: LastResult | null
  updatedAt: Date
}

const SESSION_TTL_MINUTES = 30

export async function loadSession(sessionKey: string): Promise<SessionState | null> {
  const row = await queryOne<{
    session_key: string
    last_domain: string | null
    last_result: Record<string, unknown>
    updated_at: string
  }>(
    `SELECT session_key, last_domain, last_result, updated_at
     FROM conversation_session
     WHERE session_key = $1`,
    [sessionKey]
  ).catch(() => undefined)

  if (!row) return null

  const updatedAt = new Date(row.updated_at)
  const ageMinutes = (Date.now() - updatedAt.getTime()) / 60000
  if (ageMinutes > SESSION_TTL_MINUTES) {
    // Expired — clear last_result but keep the row
    await execute(
      `UPDATE conversation_session SET last_result = '{}', last_domain = NULL, updated_at = NOW() WHERE session_key = $1`,
      [sessionKey]
    ).catch(() => {})
    return null
  }

  return {
    sessionKey: row.session_key,
    lastDomain: row.last_domain,
    lastResult: Object.keys(row.last_result).length > 0 ? (row.last_result as unknown as LastResult) : null,
    updatedAt,
  }
}

export async function saveSession(
  sessionKey: string,
  update: Partial<Pick<SessionState, 'lastDomain' | 'lastResult'>>
): Promise<void> {
  await execute(
    `INSERT INTO conversation_session (session_key, last_domain, last_result, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (session_key) DO UPDATE
       SET last_domain = EXCLUDED.last_domain,
           last_result = EXCLUDED.last_result,
           updated_at = NOW()`,
    [sessionKey, update.lastDomain ?? null, JSON.stringify(update.lastResult ?? {})]
  ).catch(() => {})
}

export async function touchSession(sessionKey: string): Promise<void> {
  await execute(
    `INSERT INTO conversation_session (session_key, updated_at)
     VALUES ($1, NOW())
     ON CONFLICT (session_key) DO UPDATE SET updated_at = NOW()`,
    [sessionKey]
  ).catch(() => {})
}
