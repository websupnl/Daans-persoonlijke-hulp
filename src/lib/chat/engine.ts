import { execute, query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
<<<<<<< HEAD
import { executeActions } from '@/lib/ai/execute-actions'
import { buildChatContext, getSessionKey } from './context'
import { DEFAULT_PROFILE_FACTS } from './default-profile'
import { normalizeDutch } from './normalize'
import { planMessage, SMALL_TALK_RESPONSES } from './deterministic'
import { executeChatActions } from './actions-runner'

export { planMessage, SMALL_TALK_RESPONSES, executeChatActions }

import type {
  ChatAction,
  ChatQuery,
=======
import { executeActions, ActionResult } from '@/lib/ai/execute-actions'
import { buildChatContext, getSessionKey } from './context'
import { normalizeDutch } from './normalize'
import { planMessage, SMALL_TALK_RESPONSES } from './deterministic'

import type {
  ChatAction,
>>>>>>> origin/main
  ChatRequest,
  ChatResult,
  ChatRuntimeContext,
  StoredAction,
} from './types'
<<<<<<< HEAD
=======
import { AIAction } from '@/lib/ai/action-schema'

export { planMessage, SMALL_TALK_RESPONSES }
export { executeChatActions } from './actions-runner'
>>>>>>> origin/main

interface PendingPayload {
  engine: 'chat' | 'ai'
  preview: string
  actions?: ChatAction[]
  aiSummary?: string
<<<<<<< HEAD
  aiActions?: unknown[]
=======
  aiActions?: AIAction[]
>>>>>>> origin/main
}

export async function processChatMessage(request: ChatRequest): Promise<ChatResult> {
  const sessionKey = request.sessionKey ?? getSessionKey(request.source, request.senderPhone)
  const context = await buildChatContext(request.source, sessionKey)
  const userContent = formatUserMessageForStorage(request)

<<<<<<< HEAD
  await execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', ['user', userContent, '[]'])
  await logActivity({
    entityType: 'chat',
    action: 'user_message',
    title: request.message.slice(0, 80),
    summary: `Nieuw bericht via ${request.source}`,
    metadata: { source: request.source },
  })

  let result = await processWithDeterministicEngine(request.message, context)
  if (!result) {
    result = await processWithAI(request, context)
  }

  if (!result) {
    result = {
      reply: 'Ik twijfel wat je precies bedoelt. Zeg erbij of dit voor je todo’s, agenda, werklog, financiën of memory is, dan pak ik het direct goed op.',
      actions: [{ type: 'clarification_requested', data: { reason: 'no_match' } }],
      parserType: 'clarification',
      confidence: 0.2,
      intent: 'clarify',
    }
  }

  await execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', [
    'assistant',
    result.reply,
    JSON.stringify(result.actions),
  ])

  await execute(
    `
      INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [userContent, result.reply, result.parserType, result.confidence, JSON.stringify(result.actions)]
  )

  await logActivity({
    entityType: 'chat',
    action: 'assistant_message',
    title: result.reply.slice(0, 80),
    summary: `Chat verwerkt via ${result.parserType}`,
    metadata: { intent: result.intent, confidence: result.confidence, source: request.source },
  })

  return result
}

async function processWithDeterministicEngine(
  message: string,
  context: ChatRuntimeContext
): Promise<ChatResult | null> {
  const plan = planMessage(message, context)

  if (plan.primaryIntent === 'confirmation_yes') {
    return executePendingAction(context)
  }

  if (plan.primaryIntent === 'confirmation_no') {
    return cancelPendingAction(context)
  }

  if (plan.kind === 'small_talk') {
    const reply = SMALL_TALK_RESPONSES[normalizeDutch(message).split(' ')[0]] ?? 'Ik ben er. Gooi het maar op tafel.'
    return {
=======
  // 1. Store user message
  await execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', ['user', userContent, '[]'])
  
  // 2. Deterministic fast-path (Confirmation & Small Talk)
  const plan = planMessage(request.message, context)
  
  if (plan.primaryIntent === 'confirmation_yes') {
    const result = await executePendingAction(context)
    await logAndStoreResponse(userContent, result)
    return result
  }

  if (plan.primaryIntent === 'confirmation_no') {
    const result = await cancelPendingAction(context)
    await logAndStoreResponse(userContent, result)
    return result
  }

  if (plan.kind === 'small_talk') {
    const reply = SMALL_TALK_RESPONSES[normalizeDutch(request.message).split(' ')[0]] ?? 'Ik ben er voor je. Wat kan ik doen?'
    const result: ChatResult = {
>>>>>>> origin/main
      reply,
      actions: [],
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
<<<<<<< HEAD
  }

  if (plan.requiresConfirmation && plan.actions.length > 0) {
    const preview = plan.confirmationPreview ?? 'Deze actie uitvoeren'
    await savePendingAction(context, {
      engine: 'chat',
      preview,
      actions: plan.actions,
    })

    return {
      reply: `${preview}\n\nIk heb dit nog niet uitgevoerd. Antwoord met "ja" om te bevestigen of "nee" om te annuleren.`,
      actions: [{ type: 'confirmation_requested', data: { preview } }],
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
  }

  if (plan.clarification) {
    return {
      reply: plan.clarification,
      actions: [{ type: 'clarification_requested', data: { reason: plan.primaryIntent } }],
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
  }

  if (plan.query) {
    const queryResult = await runQueryPlan(plan.query, context)
    return {
      reply: queryResult.reply,
      actions: queryResult.actions,
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
  }

  if (plan.actions.length > 0) {
    const execution = await executeChatActions(plan.actions, context)
    const reply = formatExecutionReply(execution.actions, plan.suggestion)
    return {
      reply,
      actions: execution.actions,
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
  }

  return null
}

async function processWithAI(
  request: ChatRequest,
  context: ChatRuntimeContext
): Promise<ChatResult | null> {
  if (!process.env.OPENAI_API_KEY) return null

  const aiResult = await parseCommandWithAI(request.message)
  if (!aiResult || aiResult.confidence < 0.45) return null

  if (aiResult.memory_candidates?.length) {
    for (const candidate of aiResult.memory_candidates) {
      if (candidate.confidence < 0.7) continue
      await execute(
        `
          INSERT INTO memory_log (key, value, category, confidence)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT(key) DO UPDATE SET
            value = EXCLUDED.value,
            category = EXCLUDED.category,
            confidence = EXCLUDED.confidence,
            last_reinforced_at = NOW(),
            updated_at = NOW()
        `,
        [candidate.key, candidate.value, candidate.category, candidate.confidence]
      )

      // Surface to UI via Activity Log
=======
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 3. AI Processing
  const aiResult = await parseCommandWithAI(request.message)
  
  if (!aiResult || aiResult.confidence < 0.4) {
    const result: ChatResult = {
      reply: 'Ik twijfel wat je precies bedoelt. Zeg erbij of dit voor je todo’s, agenda, werklog, financiën of memory is, dan pak ik het direct goed op.',
      actions: [{ type: 'clarification_requested', data: { reason: 'low_confidence' } }],
      parserType: 'clarification',
      confidence: 0.2,
      intent: 'clarify',
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 4. Handle Memory Candidates (Grounding facts)
  if (aiResult.memory_candidates?.length) {
    for (const candidate of aiResult.memory_candidates) {
      if (candidate.confidence < 0.7) continue
      await execute(`
        INSERT INTO memory_log (key, value, category, confidence)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(key) DO UPDATE SET
          value = EXCLUDED.value,
          category = EXCLUDED.category,
          confidence = EXCLUDED.confidence,
          last_reinforced_at = NOW(),
          updated_at = NOW()
      `, [candidate.key, candidate.value, candidate.category, candidate.confidence])
      
>>>>>>> origin/main
      await logActivity({
        entityType: 'memory',
        action: 'candidate_detected',
        title: candidate.key,
<<<<<<< HEAD
        summary: `AI heeft iets nieuws over je onthouden: "${candidate.value}"`,
=======
        summary: `AI heeft iets nieuws onthouden: "${candidate.value}"`,
>>>>>>> origin/main
        metadata: { category: candidate.category, confidence: candidate.confidence },
      })
    }
  }

<<<<<<< HEAD
  if (aiResult.requires_confirmation && aiResult.actions.length > 0) {
    const preview = aiResult.summary || 'AI-actie bevestigen'
=======
  // 5. Handle Confirmations
  if (aiResult.requires_confirmation && aiResult.actions.length > 0) {
    const preview = aiResult.summary || 'Actie bevestigen'
>>>>>>> origin/main
    await savePendingAction(context, {
      engine: 'ai',
      preview,
      aiSummary: aiResult.summary,
<<<<<<< HEAD
      aiActions: aiResult.actions as unknown[],
    })

    return {
      reply: `${aiResult.summary}\n\nIk heb dit nog niet uitgevoerd. Antwoord met "ja" om te bevestigen of "nee" om te annuleren.`,
      actions: [{ type: 'confirmation_requested', data: { preview } }, { type: 'fallback_answer', data: { mode: 'ai' } }],
      parserType: 'ai_fallback',
      confidence: aiResult.confidence,
      intent: 'ai_confirm',
    }
  }

  const actionResults = aiResult.actions.length > 0
    ? await executeActions(aiResult.actions)
    : []

  const storedActions = mapAIResultsToStoredActions(actionResults, aiResult.summary)
  return {
    reply: aiResult.summary,
    actions: storedActions.length > 0 ? storedActions : [{ type: 'fallback_answer', data: { mode: 'ai' } }],
    parserType: 'ai_fallback',
    confidence: aiResult.confidence,
    intent: 'ai_fallback',
  }
}

async function runQueryPlan(queryPlan: ChatQuery, context: ChatRuntimeContext): Promise<{ reply: string; actions: StoredAction[] }> {
  switch (queryPlan.type) {
    case 'todo_list': {
      const { rows, label } = await getTodoRows(queryPlan.filter)
      if (rows.length === 0) {
        return {
          reply: 'Er staan nu geen passende open taken.',
          actions: [{ type: 'todo_listed', data: [] }],
        }
      }
      const lines = rows.map((todo) => `- ${todo.title}${todo.due_date ? ` (${todo.due_date})` : ''}`)
      return {
        reply: `${label}:\n${lines.join('\n')}`,
        actions: [{ type: 'todo_listed', data: rows }],
      }
    }

    case 'agenda_list': {
      const { rows, label } = await getAgendaRows(queryPlan)
      if (rows.length === 0) {
        return {
          reply: 'Ik zie daar geen afspraken of events voor.',
          actions: [{ type: 'events_listed', data: [] }],
        }
      }
      const lines = rows.map((event) => `- ${event.date}${event.time ? ` ${event.time}` : ''}: ${event.title}`)
      return {
        reply: `${label}:\n${lines.join('\n')}`,
        actions: [{ type: 'events_listed', data: rows }],
      }
    }

    case 'worklog_summary': {
      const summary = await getWorklogSummary(queryPlan.period)
      if (summary.entries.length === 0) {
        return {
          reply: 'Ik zie nog geen werklogs voor die periode.',
          actions: [{ type: 'worklog_listed', data: { total_minutes: 0, entries: [] } }],
        }
      }
      const totalLabel = formatDurationLabel(summary.total_minutes)
      const lines = summary.entries.map((entry) => `- ${entry.title}: ${formatDurationLabel(entry.duration_minutes)} (${entry.context})`)
      return {
        reply: `Je hebt ${totalLabel} gewerkt ${queryPlan.period === 'week' ? 'deze week' : 'vandaag'}.\n${lines.join('\n')}`,
        actions: [{ type: 'worklog_listed', data: summary }],
      }
    }

    case 'finance_summary': {
      const finance = await getFinanceSummary(queryPlan.period)
      return {
        reply: finance.reply,
        actions: [{ type: 'finance_summary', data: { total: finance.total, period: finance.period, count: finance.count } }],
      }
    }

    case 'memory_profile': {
      const reply = formatMemoryAnswer(context, queryPlan.topic)
      return {
        reply,
        actions: [{ type: 'memory_answered', data: { topic: queryPlan.topic } }],
      }
    }

    case 'project_list': {
      const rows = await query<{ id: number; title: string; status: string }>(`
        SELECT id, title, status
        FROM projects
        ${queryPlan.filter === 'active' ? "WHERE status = 'actief'" : ''}
        ORDER BY updated_at DESC
        LIMIT 12
      `).catch(() => [])
      if (rows.length === 0) {
        return {
          reply: 'Ik zie nu geen projecten die daarbij passen.',
          actions: [{ type: 'projects_listed', data: [] }],
        }
      }
      return {
        reply: `Lopende projecten:\n${rows.map((project) => `- ${project.title} (${project.status})`).join('\n')}`,
        actions: [{ type: 'projects_listed', data: rows }],
      }
    }

    case 'contact_lookup': {
      const reply = await buildContactAnswer(queryPlan.query)
      return {
        reply,
        actions: [{ type: 'contact_answered', data: { query: queryPlan.query } }],
      }
    }
  }
}

export function formatExecutionReply(actions: StoredAction[], suggestion?: string): string {
  const lines: string[] = []

  for (const action of actions) {
    switch (action.type) {
      case 'todo_created':
        lines.push(`Ik heb "${action.data.title}" in je todo’s gezet${action.data.due_date ? ` voor ${action.data.due_date}` : ''}.`)
        break
      case 'todo_updated':
        lines.push(`Ik heb die taak bijgewerkt${action.data.priority ? ` en op ${action.data.priority} gezet` : ''}.`)
        break
      case 'todo_completed':
        lines.push(`Ik heb "${action.data.title}" als afgerond gemarkeerd.`)
        break
      case 'todo_deleted':
        lines.push(`Ik heb "${action.data.title}" verwijderd uit je todo’s.`)
        break
      case 'todos_deleted':
        lines.push(`Ik heb ${action.data.count} taken verwijderd.`)
        break
      case 'event_created': {
        const when = action.data.time ? `${action.data.date} om ${action.data.time}` : action.data.date
        lines.push(`Ik heb "${action.data.title}" in je agenda gezet op ${when}.`)
        break
      }
      case 'event_updated': {
        const when = action.data.time ? `${action.data.date} om ${action.data.time}` : action.data.date
        lines.push(`Ik heb "${action.data.title}" verplaatst naar ${when}.`)
        break
      }
      case 'worklog_created':
        lines.push(`Ik heb ${formatDurationLabel(action.data.duration_minutes)} werk gelogd in je werklog voor "${action.data.title}".`)
        break
      case 'worklog_updated':
        lines.push(`Ik heb je laatste werklog aangepast naar ${formatDurationLabel(action.data.duration_minutes)}.`)
        break
      case 'habit_logged':
        lines.push(`Ik heb "${action.data.habit_name}" gelogd bij je gewoontes.`)
        break
      case 'finance_created':
        lines.push(`Ik heb ${action.data.kind === 'uitgave' ? 'een uitgave' : action.data.kind === 'factuur' ? 'een factuur' : 'een financieel item'} opgeslagen: ${action.data.title}${action.data.amount ? ` voor €${action.data.amount.toFixed(2)}` : ''}.`)
        break
      case 'project_created':
        lines.push(`Ik heb project "${action.data.title}" aangemaakt.`)
        break
      case 'project_updated':
        lines.push(`Ik heb project "${action.data.title}" bijgewerkt${action.data.status ? ` naar ${action.data.status}` : ''}.`)
        break
      case 'contact_created':
        lines.push(`Ik heb contact "${action.data.name}" toegevoegd${action.data.company ? ` bij ${action.data.company}` : ''}.`)
        break
      case 'timeline_logged':
        lines.push(`Ik heb "${action.data.title}" op je timeline gezet${action.data.summary ? `: ${action.data.summary}` : ''}.`)
        break
      case 'memory_saved':
        lines.push(`Ik heb dit onthouden onder "${action.data.key}".`)
        break
      case 'inbox_captured':
        lines.push('Ik heb het in je inbox gezet voor later.')
        break
    }
  }

  if (lines.length === 0) {
    lines.push('Ik heb het verwerkt.')
  }

  if (suggestion) {
    lines.push(`\n${suggestion}`)
  }

  return lines.join('\n')
=======
      aiActions: aiResult.actions as AIAction[],
    })

    const result: ChatResult = {
      reply: `${aiResult.summary}\n\nAntwoord met "ja" om te bevestigen of "nee" om te annuleren.`,
      actions: [{ type: 'confirmation_requested', data: { preview } }],
      parserType: 'ai',
      confidence: aiResult.confidence,
      intent: 'ai_confirm',
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 6. Execute Actions
  let storedActions: StoredAction[] = []
  if (aiResult.actions.length > 0) {
    const actionResults = await executeActions(aiResult.actions as any[])
    storedActions = mapAIResultsToStoredActions(actionResults, aiResult.summary)
  }

  // 7. Final Result
  const result: ChatResult = {
    reply: aiResult.summary,
    actions: storedActions.length > 0 ? storedActions : [],
    parserType: 'ai',
    confidence: aiResult.confidence,
    intent: 'ai_processed',
  }

  await logAndStoreResponse(userContent, result)
  return result
}

async function logAndStoreResponse(userMessage: string, result: ChatResult) {
  await execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', [
    'assistant',
    result.reply,
    JSON.stringify(result.actions),
  ])

  await execute(`
    INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
    VALUES ($1, $2, $3, $4, $5)
  `, [userMessage, result.reply, result.parserType, result.confidence, JSON.stringify(result.actions)])

  await logActivity({
    entityType: 'chat',
    action: 'assistant_message',
    title: result.reply.slice(0, 80),
    summary: `Chat verwerkt via ${result.parserType}`,
    metadata: { intent: result.intent, confidence: result.confidence },
  })
>>>>>>> origin/main
}

async function executePendingAction(context: ChatRuntimeContext): Promise<ChatResult> {
  if (!context.pendingAction) {
    return {
      reply: 'Er staat niets open om te bevestigen.',
      actions: [],
      parserType: 'confirmation',
      confidence: 0.5,
      intent: 'confirmation_empty',
    }
  }

  const payload = JSON.parse(context.pendingAction.payload) as PendingPayload
  await clearPendingAction(context.sessionKey)

<<<<<<< HEAD
  if (payload.engine === 'chat' && payload.actions?.length) {
    const execution = await executeChatActions(payload.actions, context)
    return {
      reply: formatExecutionReply(execution.actions),
      actions: [{ type: 'confirmation_executed', data: { preview: payload.preview } }, ...execution.actions],
      parserType: 'confirmation',
      confidence: 0.99,
      intent: 'confirmation_execute',
    }
  }

  if (payload.engine === 'ai' && payload.aiActions?.length) {
    const actionResults = await executeActions(payload.aiActions as never[])
=======
  if (payload.aiActions?.length) {
    const actionResults = await executeActions(payload.aiActions)
>>>>>>> origin/main
    const stored = mapAIResultsToStoredActions(actionResults, payload.aiSummary)
    return {
      reply: payload.aiSummary ?? 'Uitgevoerd.',
      actions: [{ type: 'confirmation_executed', data: { preview: payload.preview } }, ...stored],
      parserType: 'confirmation',
      confidence: 0.99,
      intent: 'confirmation_execute',
    }
  }

  return {
<<<<<<< HEAD
    reply: 'Er stond wel een bevestiging open, maar ik kon de actie niet meer uitvoeren.',
=======
    reply: 'Bevestiging mislukt of actie was niet meer geldig.',
>>>>>>> origin/main
    actions: [],
    parserType: 'confirmation',
    confidence: 0.3,
    intent: 'confirmation_failed',
  }
}

async function cancelPendingAction(context: ChatRuntimeContext): Promise<ChatResult> {
  if (!context.pendingAction) {
    return {
<<<<<<< HEAD
      reply: 'Prima, er stond niets open om te annuleren.',
=======
      reply: 'Er staat niets open om te annuleren.',
>>>>>>> origin/main
      actions: [],
      parserType: 'confirmation',
      confidence: 0.5,
      intent: 'confirmation_cancel_empty',
    }
  }

  const payload = JSON.parse(context.pendingAction.payload) as PendingPayload
  await clearPendingAction(context.sessionKey)

  return {
<<<<<<< HEAD
    reply: 'Ik heb het geannuleerd. Er is niets uitgevoerd.',
=======
    reply: 'Ik heb het geannuleerd.',
>>>>>>> origin/main
    actions: [{ type: 'confirmation_cancelled', data: { preview: payload.preview } }],
    parserType: 'confirmation',
    confidence: 0.99,
    intent: 'confirmation_cancel',
  }
}

async function savePendingAction(context: ChatRuntimeContext, payload: PendingPayload): Promise<void> {
<<<<<<< HEAD
  await execute(
    `
      INSERT INTO pending_actions (session_key, source, preview, payload, expires_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours', NOW())
      ON CONFLICT(session_key) DO UPDATE SET
        source = EXCLUDED.source,
        preview = EXCLUDED.preview,
        payload = EXCLUDED.payload,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
    [context.sessionKey, String(context.source), payload.preview, JSON.stringify(payload)]
  )
=======
  await execute(`
    INSERT INTO pending_actions (session_key, source, preview, payload, expires_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours', NOW())
    ON CONFLICT(session_key) DO UPDATE SET
      source = EXCLUDED.source,
      preview = EXCLUDED.preview,
      payload = EXCLUDED.payload,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `, [context.sessionKey, String(context.source), payload.preview, JSON.stringify(payload)])
>>>>>>> origin/main
}

async function clearPendingAction(sessionKey: string): Promise<void> {
  await execute('DELETE FROM pending_actions WHERE session_key = $1', [sessionKey])
}

<<<<<<< HEAD
async function getTodoRows(filter: Extract<ChatQuery, { type: 'todo_list' }>['filter']) {
  let where = 'WHERE completed = 0'
  let label = 'Open taken'
  if (filter === 'today') {
    where += ' AND due_date = CURRENT_DATE'
    label = 'Taken voor vandaag'
  } else if (filter === 'week') {
    where += " AND due_date <= CURRENT_DATE + INTERVAL '7 days'"
    label = 'Taken voor deze week'
  } else if (filter === 'overdue') {
    where += ' AND due_date < CURRENT_DATE'
    label = 'Achterstallige taken'
  }
  const rows = await query<{ id: number; title: string; priority?: string; due_date?: string | null }>(`
    SELECT id, title, priority, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date
    FROM todos
    ${where}
    ORDER BY CASE priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, due_date ASC NULLS LAST
    LIMIT 12
  `).catch(() => [])

  return { rows, label }
}

async function getAgendaRows(queryPlan: Extract<ChatQuery, { type: 'agenda_list' }>) {
  let where = "date >= CURRENT_DATE AND date <= CURRENT_DATE + INTERVAL '7 days'"
  let label = 'Agenda deze week'
  if (queryPlan.filter === 'today') {
    where = 'date = CURRENT_DATE'
    label = 'Agenda vandaag'
  } else if (queryPlan.filter === 'tomorrow') {
    where = "date = CURRENT_DATE + INTERVAL '1 day'"
    label = 'Agenda morgen'
  }
  const rows = await query<{ id: number; title: string; date: string; time?: string | null; type?: string }>(`
    SELECT id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, time, type
    FROM events
    WHERE ${where}
    ORDER BY date ASC, time ASC NULLS LAST
    LIMIT 12
  `).catch(() => [])
  return { rows, label }
}

async function getWorklogSummary(period: 'today' | 'week' | undefined) {
  const range = period === 'week'
    ? "date >= CURRENT_DATE - INTERVAL '6 days'"
    : 'date = CURRENT_DATE'
  const entries = await query<{ id: number; title: string; duration_minutes: number; context: string }>(`
    SELECT id, title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes, context
    FROM work_logs
    WHERE ${range}
    ORDER BY created_at DESC
    LIMIT 12
  `).catch(() => [])
  const total = await queryOne<{ total: number }>(`
    SELECT COALESCE(SUM(COALESCE(actual_duration_minutes, duration_minutes)), 0) as total
    FROM work_logs
    WHERE ${range}
  `)
  return { entries, total_minutes: Number(total?.total ?? 0) }
}

async function getFinanceSummary(period: 'today' | 'week' | 'month' | undefined) {
  let where = "created_at >= DATE_TRUNC('month', CURRENT_DATE)"
  let periodLabel = 'deze maand'
  if (period === 'today') {
    where = 'DATE(created_at) = CURRENT_DATE'
    periodLabel = 'vandaag'
  } else if (period === 'week') {
    where = "created_at >= CURRENT_DATE - INTERVAL '6 days'"
    periodLabel = 'deze week'
  }
  const row = await queryOne<{ total: number; count: number }>(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM finance_items
    WHERE type = 'uitgave' AND ${where}
  `)
  const total = Number(row?.total ?? 0)
  return {
    total,
    count: Number(row?.count ?? 0),
    period: periodLabel,
    reply: `Je hebt ${periodLabel} €${total.toFixed(2)} uitgegeven.`,
  }
}

function formatMemoryAnswer(context: ChatRuntimeContext, topic?: string): string {
  const normalizedTopic = topic ? normalizeDutch(topic) : ''
  const memoryFacts = context.memories
    .filter((item) => !normalizedTopic || normalizeDutch(`${item.key} ${item.value} ${item.category}`).includes(normalizedTopic))
    .slice(0, 6)
    .map((item) => `- ${item.value}`)

  const defaultFacts = DEFAULT_PROFILE_FACTS
    .filter((fact) => !normalizedTopic || fact.tags.some((tag) => normalizeDutch(tag).includes(normalizedTopic)))
    .slice(0, 4)
    .map((fact) => `- ${fact.value}`)

  const projectFacts = (!normalizedTopic || normalizedTopic.includes('project'))
    ? context.activeProjects.slice(0, 5).map((project) => `- Actief project: ${project.title}`)
    : []

  const facts = Array.from(new Set([...defaultFacts, ...memoryFacts, ...projectFacts])).slice(0, 8)

  if (facts.length === 0) {
    return 'Ik heb hier nog weinig expliciete memory over. Sla belangrijke context op met "onthoud dat ..." en dan kan ik er straks beter op terugvallen.'
  }

  return `Dit weet ik nu${topic ? ` over ${topic}` : ' over jou'}:\n${facts.join('\n')}`
}

async function buildContactAnswer(queryText: string): Promise<string> {
  const queryValue = queryText.trim()
  if (!queryValue) {
    return 'Noem even de naam van het contact of bedrijf waar je naar zoekt.'
  }
  const contact = await queryOne<{ name: string; company?: string | null; email?: string | null; phone?: string | null }>(`
    SELECT name, company, email, phone
    FROM contacts
    WHERE name ILIKE $1 OR company ILIKE $1
    ORDER BY updated_at DESC
    LIMIT 1
  `, [`%${queryValue}%`])

  if (!contact) {
    return `Ik vond nog geen contact of koppeling voor "${queryValue}".`
  }

  const details = [
    `Naam: ${contact.name}`,
    contact.company ? `Bedrijf: ${contact.company}` : null,
    contact.email ? `E-mail: ${contact.email}` : null,
    contact.phone ? `Telefoon: ${contact.phone}` : null,
  ].filter(Boolean)

  return details.join('\n')
}

function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) return `${hours} uur en ${rest} min`
  if (hours > 0) return `${hours} uur`
  return `${rest} min`
}

=======
>>>>>>> origin/main
function formatUserMessageForStorage(request: ChatRequest): string {
  if (request.source === 'telegram') {
    const sender = request.senderName ? ` - ${request.senderName}` : ''
    return `[telegram${sender}] ${request.message}`
  }
  return request.message
}

function mapAIResultsToStoredActions(
<<<<<<< HEAD
  actionResults: Array<{ type: string; success: boolean; data?: unknown }>,
=======
  actionResults: ActionResult[],
>>>>>>> origin/main
  summary?: string
): StoredAction[] {
  const mapped: StoredAction[] = []

  for (const result of actionResults) {
    if (!result.success) continue
<<<<<<< HEAD
    switch (result.type) {
      case 'todo_create':
        mapped.push({ type: 'todo_created', data: { id: (result.data as { id?: number; title?: string })?.id, title: (result.data as { title?: string })?.title ?? 'Taak' } })
        break
      case 'event_create': {
        const data = result.data as { id?: number; title: string; date: string; time?: string | null }
        mapped.push({ type: 'event_created', data: { id: data.id, title: data.title, date: data.date, time: data.time ?? null } })
        break
      }
      case 'worklog_create': {
        const data = result.data as { id?: number; duration_minutes: number }
        mapped.push({ type: 'worklog_created', data: { id: data.id, title: summary ?? 'Werklog', duration_minutes: data.duration_minutes, context: 'overig' } })
        break
      }
      case 'habit_log':
        mapped.push({ type: 'habit_logged', data: { habit_name: summary ?? 'Gewoonte' } })
        break
      case 'finance_create_expense': {
        const data = result.data as { id?: number }
        mapped.push({ type: 'finance_created', data: { id: data.id, title: summary ?? 'Uitgave', amount: 0, kind: 'uitgave' } })
        break
      }
      case 'project_create': {
        const data = result.data as { id?: number; title?: string }
        mapped.push({ type: 'project_created', data: { id: data.id, title: data.title ?? summary ?? 'Project' } })
        break
      }
      case 'contact_create': {
        const data = result.data as { id?: number; name?: string }
        mapped.push({ type: 'contact_created', data: { id: data.id, name: data.name ?? summary ?? 'Contact' } })
        break
      }
      case 'memory_store': {
        const data = result.data as { key?: string; value?: string; category?: string }
        mapped.push({ type: 'memory_saved', data: { key: data.key ?? 'Memory', value: data.value ?? '', category: data.category ?? 'general' } })
        break
      }
      case 'inbox_capture': {
        mapped.push({ type: 'inbox_captured', data: { text: summary ?? 'Captur' } })
        break
      }
    }
  }

  if (mapped.length === 0 && summary) {
    mapped.push({ type: 'fallback_answer', data: { mode: 'ai' } })
  }

=======
    const data = result.data as any
    switch (result.type) {
      case 'todo_create':
        mapped.push({ type: 'todo_created', data: { id: data?.id, title: data?.title ?? 'Taak' } })
        break
      case 'todo_update':
        mapped.push({ type: 'todo_updated', data: { id: data?.id, title: data?.title } })
        break
      case 'todo_complete':
        mapped.push({ type: 'todo_completed', data: { id: data?.id, title: data?.title ?? 'Taak' } })
        break
      case 'event_create':
        mapped.push({ type: 'event_created', data: { id: data?.id, title: data?.title, date: data?.date, time: data?.time } })
        break
      case 'worklog_create':
        mapped.push({ type: 'worklog_created', data: { id: data?.id, title: data?.title ?? summary ?? 'Werklog', duration_minutes: data?.duration_minutes ?? 0, context: data?.context ?? 'overig' } })
        break
      case 'habit_log':
        mapped.push({ type: 'habit_logged', data: { habit_id: data?.id, habit_name: data?.name ?? 'Gewoonte' } })
        break
      case 'finance_create_expense':
        mapped.push({ type: 'finance_created', data: { id: data?.id, title: data?.title ?? summary ?? 'Uitgave', amount: data?.amount ?? 0, kind: 'uitgave' } })
        break
      case 'finance_create_income':
        mapped.push({ type: 'finance_created', data: { id: data?.id, title: data?.title ?? summary ?? 'Inkomst', amount: data?.amount ?? 0, kind: 'inkomst' } })
        break
      case 'project_create':
        mapped.push({ type: 'project_created', data: { id: data?.id, title: data?.title ?? 'Project' } })
        break
      case 'project_update':
        mapped.push({ type: 'project_updated', data: { id: data?.id, title: data?.title ?? 'Project', status: data?.status } })
        break
      case 'contact_create':
        mapped.push({ type: 'contact_created', data: { id: data?.id, name: data?.name ?? 'Contact' } })
        break
      case 'memory_store':
        mapped.push({ type: 'memory_saved', data: { key: data?.key ?? 'Memory', value: data?.value ?? '', category: data?.category ?? 'general' } })
        break
      case 'inbox_capture':
        mapped.push({ type: 'inbox_captured', data: { id: data?.id, text: data?.raw_text ?? 'Capture' } })
        break
    }
  }

>>>>>>> origin/main
  return mapped
}
