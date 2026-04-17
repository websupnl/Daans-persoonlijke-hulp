import { query, queryOne } from '@/lib/db'
import { stripSourcePrefix } from './normalize'
import type { ChatChannel, ChatRuntimeContext, PendingActionRecord, StoredAction } from './types'

function parseActions(actions: string | null | undefined): StoredAction[] {
  if (!actions) return []
  try {
    return JSON.parse(actions) as StoredAction[]
  } catch {
    return []
  }
}

export function getSessionKey(source: ChatChannel, senderPhone?: string): string {
  if (source === 'telegram' && senderPhone) return `telegram:${senderPhone}`
  if (source === 'telegram') return 'telegram'
  return 'chat'
}

export async function buildChatContext(
  source: ChatChannel,
  sessionKey: string
): Promise<ChatRuntimeContext> {
  const now = new Date()

  const [
    recentMessagesRaw,
    memories,
    activeProjects,
    contacts,
    openTodos,
    upcomingEvents,
    recentWorklogs,
    habits,
    pendingAction,
  ] = await Promise.all([
    query<{ role: 'user' | 'assistant'; content: string; actions: string; created_at: string }>(`
      SELECT role, content, actions, created_at
      FROM chat_messages
      ORDER BY created_at DESC
      LIMIT 20
    `),
    query<{ id: number; key: string; value: string; category: string; confidence: number }>(`
      SELECT id, key, value, category, confidence
      FROM memory_log
      ORDER BY last_reinforced_at DESC
      LIMIT 30
    `).catch(() => []),
    query<{ id: number; title: string; status: string }>(`
      SELECT id, title, status
      FROM projects
      WHERE status = 'actief'
      ORDER BY updated_at DESC
      LIMIT 20
    `).catch(() => []),
    query<{ id: number; name: string; company?: string | null }>(`
      SELECT id, name, company
      FROM contacts
      ORDER BY updated_at DESC
      LIMIT 40
    `).catch(() => []),
    query<{ id: number; title: string; priority: string; due_date?: string | null; category?: string | null }>(`
      SELECT id, title, priority, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date, category
      FROM todos
      WHERE completed = 0
      ORDER BY updated_at DESC
      LIMIT 30
    `).catch(() => []),
    query<{ id: number; title: string; date: string; time?: string | null; type: string }>(`
      SELECT id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, time, type
      FROM events
      WHERE date >= CURRENT_DATE - INTERVAL '1 day' AND date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY date ASC, time ASC NULLS LAST
      LIMIT 30
    `).catch(() => []),
    query<{ id: number; title: string; duration_minutes: number; context: string; created_at: string; date: string }>(`
      SELECT id,
             title,
             COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes,
             context,
             created_at,
             TO_CHAR(date, 'YYYY-MM-DD') as date
      FROM work_logs
      ORDER BY created_at DESC
      LIMIT 20
    `).catch(() => []),
    query<{ id: number; name: string }>(`
      SELECT id, name
      FROM habits
      WHERE active = 1
      ORDER BY created_at ASC
      LIMIT 20
    `).catch(() => []),
    queryOne<PendingActionRecord>(`
      SELECT session_key, source, preview, payload, created_at, updated_at, expires_at
      FROM pending_actions
      WHERE session_key = $1 AND expires_at > NOW()
      LIMIT 1
    `, [sessionKey]).catch(() => undefined),
  ])

  return {
    source,
    sessionKey,
    now,
    recentMessages: recentMessagesRaw
      .reverse()
      .map((message) => ({
        role: message.role,
        content: stripSourcePrefix(message.content),
        actions: parseActions(message.actions),
        created_at: message.created_at,
      })),
    memories,
    activeProjects,
    contacts,
    openTodos,
    upcomingEvents,
    recentWorklogs,
    habits,
    pendingAction,
  }
}
