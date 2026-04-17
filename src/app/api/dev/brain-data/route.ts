export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const [
    recentMessages,
    theories,
    memories,
    observations,
    sessions,
    proactiveLog,
    patternQuestions,
    financeStats,
    habitStats,
    todoStats,
  ] = await Promise.all([
    query<{
      id: number; role: string; content: string; actions: string; created_at: string
    }>(`SELECT id, role, LEFT(content, 200) as content, actions, created_at
        FROM chat_messages ORDER BY created_at DESC LIMIT 30`),

    query<{
      id: number; category: string; theory: string; confidence: number
      status: string; times_confirmed: number; impact_score: number
      action_potential: string | null; created_at: string; last_updated: string
    }>(`SELECT id, category, theory, confidence::float, status, times_confirmed,
               impact_score::float, action_potential, created_at, last_updated
        FROM ai_theories ORDER BY last_updated DESC LIMIT 50`),

    query<{
      id: number; key: string; value: string; category: string
      confidence: number; last_reinforced_at: string
    }>(`SELECT id, key, LEFT(value, 120) as value, category,
               confidence::float, last_reinforced_at
        FROM memory_log ORDER BY last_reinforced_at DESC LIMIT 60`),

    query<{
      obs_date: string; module: string; metric_key: string; metric_value: number
    }>(`SELECT obs_date, module, metric_key, metric_value::float
        FROM pattern_observations
        WHERE obs_date >= CURRENT_DATE - 14
        ORDER BY obs_date DESC, module`),

    query<{
      session_key: string; last_domain: string | null
      last_result: Record<string, unknown>; updated_at: string
    }>(`SELECT session_key, last_domain, last_result, updated_at
        FROM conversation_session
        ORDER BY updated_at DESC LIMIT 10`),

    query<{
      id: number; trigger_type: string; telegram_sent: number; created_at: string
    }>(`SELECT id, trigger_type, telegram_sent, created_at
        FROM proactive_log ORDER BY created_at DESC LIMIT 40`),

    query<{
      id: number; question: string; source_module: string; status: string
      priority: number; confidence: number; created_at: string
    }>(`SELECT id, LEFT(question, 100) as question, source_module, status,
               priority, confidence::float, created_at
        FROM pending_questions ORDER BY created_at DESC LIMIT 20`),

    query<{
      type: string; total: number; count: number
    }>(`SELECT type, SUM(amount)::float as total, COUNT(*)::int as count
        FROM finance_items WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY type`),

    query<{
      name: string; completed_today: number; streak_7d: number
    }>(`SELECT h.name,
               (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id AND hl.logged_date = CURRENT_DATE)::int as completed_today,
               (SELECT COUNT(*) FROM habit_logs hl2 WHERE hl2.habit_id = h.id AND hl2.logged_date >= CURRENT_DATE - 7)::int as streak_7d
        FROM habits h WHERE h.active = 1 ORDER BY h.name`),

    queryOne<{
      open: number; overdue: number; high: number; completed_today: number
    }>(`SELECT
         COUNT(*) FILTER (WHERE completed = 0)::int as open,
         COUNT(*) FILTER (WHERE completed = 0 AND due_date < CURRENT_DATE)::int as overdue,
         COUNT(*) FILTER (WHERE completed = 0 AND priority = 'hoog')::int as high,
         COUNT(*) FILTER (WHERE completed = 1 AND completed_at::date = CURRENT_DATE)::int as completed_today
       FROM todos`),
  ])

  const parsedMessages = recentMessages.map(m => ({
    ...m,
    actions: (() => { try { return JSON.parse(m.actions || '[]') } catch { return [] } })(),
  }))

  // Derive parser stats from recent messages
  const assistantMessages = parsedMessages.filter(m => m.role === 'assistant')
  const parserCounts: Record<string, number> = {}
  for (const m of assistantMessages) {
    const actions = m.actions as Array<{ parserType?: string; type?: string }>
    const parser = (actions as any)?.parserType ?? 'unknown'
    parserCounts[parser] = (parserCounts[parser] ?? 0) + 1
  }

  return NextResponse.json({
    messages: parsedMessages,
    theories,
    memories,
    observations,
    sessions,
    proactiveLog,
    patternQuestions,
    financeStats,
    habitStats,
    todoStats,
    meta: {
      timestamp: new Date().toISOString(),
      messageCount: parsedMessages.length,
      theoryCount: theories.length,
      memoryCount: memories.length,
    },
  })
}
