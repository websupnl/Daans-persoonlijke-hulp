import { execute, query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions, ActionResult } from '@/lib/ai/execute-actions'
import { buildChatContext, getSessionKey } from './context'
import { normalizeDutch } from './normalize'
import { planMessage, SMALL_TALK_RESPONSES } from './deterministic'

import type {
  ChatAction,
  ChatRequest,
  ChatResult,
  ChatRuntimeContext,
  StoredAction,
} from './types'
import { AIAction } from '@/lib/ai/action-schema'

export { planMessage, SMALL_TALK_RESPONSES }
export { executeChatActions } from './actions-runner'

interface PendingPayload {
  engine: 'chat' | 'ai'
  preview: string
  actions?: ChatAction[]
  aiSummary?: string
  aiActions?: AIAction[]
}

export async function processChatMessage(request: ChatRequest): Promise<ChatResult> {
  const sessionKey = request.sessionKey ?? getSessionKey(request.source, request.senderPhone)
  const context = await buildChatContext(request.source, sessionKey)
  const userContent = formatUserMessageForStorage(request)

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
      reply,
      actions: [],
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 3. AI Processing
  const aiResult = await parseCommandWithAI(request.message, sessionKey)
  
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
      
      await logActivity({
        entityType: 'memory',
        action: 'candidate_detected',
        title: candidate.key,
        summary: `AI heeft iets nieuws onthouden: "${candidate.value}"`,
        metadata: { category: candidate.category, confidence: candidate.confidence },
      })
    }
  }

  // 5. Handle Confirmations
  if (aiResult.requires_confirmation && aiResult.actions.length > 0) {
    const preview = aiResult.summary || 'Actie bevestigen'
    await savePendingAction(context, {
      engine: 'ai',
      preview,
      aiSummary: aiResult.summary,
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

  if (payload.aiActions?.length) {
    const actionResults = await executeActions(payload.aiActions)
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
    reply: 'Bevestiging mislukt of actie was niet meer geldig.',
    actions: [],
    parserType: 'confirmation',
    confidence: 0.3,
    intent: 'confirmation_failed',
  }
}

async function cancelPendingAction(context: ChatRuntimeContext): Promise<ChatResult> {
  if (!context.pendingAction) {
    return {
      reply: 'Er staat niets open om te annuleren.',
      actions: [],
      parserType: 'confirmation',
      confidence: 0.5,
      intent: 'confirmation_cancel_empty',
    }
  }

  const payload = JSON.parse(context.pendingAction.payload) as PendingPayload
  await clearPendingAction(context.sessionKey)

  return {
    reply: 'Ik heb het geannuleerd.',
    actions: [{ type: 'confirmation_cancelled', data: { preview: payload.preview } }],
    parserType: 'confirmation',
    confidence: 0.99,
    intent: 'confirmation_cancel',
  }
}

async function savePendingAction(context: ChatRuntimeContext, payload: PendingPayload): Promise<void> {
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
}

async function clearPendingAction(sessionKey: string): Promise<void> {
  await execute('DELETE FROM pending_actions WHERE session_key = $1', [sessionKey])
}

function formatUserMessageForStorage(request: ChatRequest): string {
  if (request.source === 'telegram') {
    const sender = request.senderName ? ` - ${request.senderName}` : ''
    return `[telegram${sender}] ${request.message}`
  }
  return request.message
}

function mapAIResultsToStoredActions(
  actionResults: ActionResult[],
  summary?: string
): StoredAction[] {
  const mapped: StoredAction[] = []

  for (const result of actionResults) {
    if (!result.success) continue
    const data = result.data as any
    switch (result.type) {
      case 'todo_create':
        mapped.push({ type: 'todo_created', data: { id: data?.id, title: data?.title ?? 'Taak' } })
        break
      case 'todo_update':
        mapped.push({ type: 'todo_updated', data: { id: data?.id, title: data?.title } })
        break
      case 'todo_delete':
        mapped.push({ type: 'todo_deleted', data: { id: data?.id, title: data?.title ?? 'Taak' } })
        break
      case 'todo_delete_many':
        mapped.push({ type: 'todos_deleted', data: { count: data?.count ?? 0 } })
        break
      case 'todo_complete':
        mapped.push({ type: 'todo_completed', data: { id: data?.id, title: data?.title ?? 'Taak' } })
        break
      case 'event_create':
        mapped.push({ type: 'event_created', data: { id: data?.id, title: data?.title, date: data?.date, time: data?.time } })
        break
      case 'event_update':
        mapped.push({ type: 'event_updated', data: { id: data?.id, title: data?.title, date: data?.date, time: data?.time } })
        break
      case 'worklog_create':
        mapped.push({ type: 'worklog_created', data: { id: data?.id, title: data?.title ?? summary ?? 'Werklog', duration_minutes: data?.duration_minutes ?? 0, context: data?.context ?? 'overig' } })
        break
      case 'worklog_update_last':
        mapped.push({ type: 'worklog_updated', data: { id: data?.id, title: data?.title ?? 'Werklog', duration_minutes: data?.duration_minutes ?? 0 } })
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
      case 'timer_start':
        mapped.push({ type: 'timer_started', data: { id: data?.id, title: data?.title ?? 'Timer', project_id: data?.project_id } })
        break
      case 'timer_stop':
        mapped.push({ type: 'timer_stopped', data: { id: data?.id, title: data?.title ?? 'Timer', duration_minutes: data?.duration_minutes ?? 0 } })
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

  return mapped
}
