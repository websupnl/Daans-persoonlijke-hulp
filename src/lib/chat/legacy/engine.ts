import { execute, query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions, ActionResult } from '@/lib/ai/execute-actions'
import { parseIntent } from '@/lib/chat-parser'
import { buildChatContext, getSessionKey } from '../context'
import { normalizeDutch } from '../normalize'
import { planMessage, SMALL_TALK_RESPONSES } from '../deterministic'
import { loadSession, saveSession } from '../session-state'
import { extractAndLogHabits } from '@/lib/ai/habit-extractor'

import type {
  ChatAction,
  ChatRequest,
  ChatResult,
  ChatRuntimeContext,
  StoredAction,
} from '../types'
import { AIAction } from '@/lib/ai/action-schema'

// Background sync trigger (non-blocking)
async function triggerBackgroundSync() {
  try {
    // In production, use the actual deployment URL
    // In development, fallback to localhost
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_APP_URL || 'https://daans-persoonlijke-hulp.vercel.app'
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    fetch(`${baseUrl}/api/ai/sync`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => console.error('[BackgroundSync] Fetch error:', err))
  } catch (err) {
    console.error('[BackgroundSync] Error:', err)
  }
}

export { planMessage, SMALL_TALK_RESPONSES }
export { executeChatActions } from './actions-runner'

interface PendingPayload {
  engine: 'chat' | 'ai'
  preview: string
  actions?: ChatAction[]
  aiSummary?: string
  aiActions?: AIAction[]
}

async function buildDeterministicListResponse(intent: ReturnType<typeof parseIntent>): Promise<ChatResult | null> {
  if (intent.intent === 'todo_list') {
    const filter = String(intent.params.filter || 'open').toLowerCase()
    const conditions = ['t.completed = 0']
    const label = filter === 'today' || filter === 'vandaag'
      ? 'vandaag'
      : filter === 'deze week' || filter === 'week'
        ? 'deze week'
        : filter === 'overdue' || filter === 'te laat'
          ? 'te laat'
          : 'open'

    if (filter === 'today' || filter === 'vandaag') {
      conditions.push('t.due_date::date = CURRENT_DATE')
    } else if (filter === 'deze week' || filter === 'week') {
      conditions.push("t.due_date::date <= CURRENT_DATE + INTERVAL '7 days'")
    } else if (filter === 'overdue' || filter === 'te laat') {
      conditions.push('t.due_date::date < CURRENT_DATE')
    } else if (filter === 'completed' || filter === 'afgerond') {
      conditions.length = 0
      conditions.push('t.completed = 1')
    }

    const todos = await query<{ id: number; title: string; priority: string; due_date?: string | null }>(`
      SELECT t.id, t.title, t.priority, TO_CHAR(t.due_date, 'YYYY-MM-DD') as due_date
      FROM todos t
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE t.priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT 20
    `).catch(() => [])

    const reply = todos.length === 0
      ? 'Geen open todos gevonden.'
      : `Open todos (${label}):\n${todos.map(todo => `• ${todo.title}${todo.due_date ? ` (${todo.due_date})` : ''}`).join('\n')}`

    return {
      reply,
      actions: [{ type: 'todo_listed', data: todos }],
      parserType: 'deterministic',
      confidence: Math.max(intent.confidence, 0.9),
      intent: intent.intent,
    }
  }

  if (intent.intent === 'event_list') {
    const filter = String(intent.params.filter || 'deze week').toLowerCase()
    let startSql = 'CURRENT_DATE'
    let endSql = "CURRENT_DATE + INTERVAL '7 days'"
    let label = 'deze week'

    if (filter === 'vandaag' || filter === 'today') {
      startSql = 'CURRENT_DATE'
      endSql = 'CURRENT_DATE'
      label = 'vandaag'
    } else if (filter === 'morgen' || filter === 'tomorrow') {
      startSql = "CURRENT_DATE + INTERVAL '1 day'"
      endSql = "CURRENT_DATE + INTERVAL '1 day'"
      label = 'morgen'
    }

    const events = await query<{ id: number; title: string; date: string; time?: string | null; type?: string }>(`
      SELECT id, title, TO_CHAR(date, 'YYYY-MM-DD') as date, time, type
      FROM events
      WHERE date BETWEEN ${startSql} AND ${endSql}
      ORDER BY date ASC, time ASC NULLS LAST, created_at ASC
      LIMIT 20
    `).catch(() => [])

    const reply = events.length === 0
      ? 'Geen agenda-items gevonden.'
      : `Agenda ${label}:\n${events.map(event => `• ${event.date}${event.time ? ` ${event.time}` : ''}: ${event.title}`).join('\n')}`

    return {
      reply,
      actions: [{ type: 'events_listed', data: events }],
      parserType: 'deterministic',
      confidence: Math.max(intent.confidence, 0.9),
      intent: intent.intent,
    }
  }

  return null
}

function buildFallbackActionsFromIntent(intent: ReturnType<typeof parseIntent>, rawMessage: string): AIAction[] {
  if (intent.intent === 'grocery_add') {
    const rawTitle = String(intent.params.title || rawMessage)
    return parseGroceryItems(rawTitle).map(title => ({
      type: 'grocery_create' as const,
      payload: { title, category: 'overig' },
    }))
  }

  if (intent.intent === 'todo_add') {
    return [{
      type: 'todo_create' as const,
      payload: {
        title: String(intent.params.title || rawMessage),
        priority: (intent.params.priority as 'hoog' | 'medium' | 'laag' | undefined) || 'medium',
        due_date: intent.params.due_date as string | undefined,
        category: intent.params.category as string | undefined,
      },
    }]
  }

  if (intent.intent === 'event_add') {
    return [{
      type: 'event_create' as const,
      payload: {
        title: String(intent.params.title || rawMessage),
        date: String(intent.params.date || new Date().toISOString().split('T')[0]),
        time: intent.params.time as string | undefined,
        type: (intent.params.type as 'vergadering' | 'deadline' | 'afspraak' | 'herinnering' | 'algemeen' | undefined) || 'algemeen',
      },
    }]
  }

  return []
}

function buildFallbackSummary(intent: ReturnType<typeof parseIntent>, actionResults: ActionResult[], rawMessage: string): string {
  const firstSuccess = actionResults.find(result => result.success)?.data as Record<string, unknown> | undefined

  if (intent.intent === 'grocery_add') {
    const titles = actionResults.filter(r => r.success).map(r => String((r.data as Record<string, unknown> | undefined)?.title || ''))
    if (titles.length > 1) return `Toegevoegd aan boodschappenlijst:\n${titles.map(title => `• ${title}`).join('\n')}`
    return `Toegevoegd aan boodschappenlijst: ${titles[0] || String(intent.params.title || rawMessage)}`
  }

  if (intent.intent === 'todo_add') {
    return `Todo toegevoegd: ${String(firstSuccess?.title || intent.params.title || rawMessage)}`
  }

  if (intent.intent === 'event_add') {
    const title = String(firstSuccess?.title || intent.params.title || rawMessage)
    const date = String(firstSuccess?.date || intent.params.date || '')
    const time = firstSuccess?.time ? ` om ${String(firstSuccess.time)}` : ''
    return `Agenda-item toegevoegd: ${title}${date ? ` op ${date}${time}` : ''}`
  }

  return String(intent.params.title || rawMessage)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: Grocery fast-path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split raw grocery text into individual items.
 * "koffie, melk en brood" → ["koffie", "melk", "brood"]
 * "koffie melk halen"     → ["koffie melk"]  (single item, strip verb)
 */
function parseGroceryItems(text: string): string[] {
  const STOP_WORDS = new Set(['halen', 'kopen', 'pakken', 'meenemen', 'haal', 'koop', 'pak', 'nodig', 'graag'])

  // Clean trailing action verbs
  const cleaned = text.replace(/\b(halen|kopen|pakken|meenemen)\b\.?$/gi, '').trim()

  let parts: string[]
  if (cleaned.includes(',') || /\s+en\s+/i.test(cleaned) || cleaned.includes(';') || cleaned.includes('\n')) {
    // Explicit separators → split on them
    parts = cleaned.split(/,|\s+en\s+|;|\n/).map(s => s.trim())
  } else {
    // No separators → treat as single item (may be multi-word: "pindakaas met honing")
    parts = [cleaned]
  }

  return parts
    .map(s => s.trim().replace(/[.,!?]+$/, ''))
    .filter(s => s.length > 1 && !STOP_WORDS.has(s.toLowerCase()))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: Follow-up detection
// ─────────────────────────────────────────────────────────────────────────────

function isFollowUpMessage(message: string): boolean {
  return /^(meer info|meer informatie|geef details|details|vertel meer|zeg meer|wat precies|welke transactie|transactie(nummer)?|welk nummer|meer|expand|uitleggen|toon meer)\b/i.test(
    message.trim()
  )
}

async function handleFinanceFollowUp(
  transactionIds: number[],
  sessionKey: string,
  userContent: string
): Promise<ChatResult | null> {
  if (!transactionIds.length) return null

  const transactions = await query<{
    id: number; title: string; amount: number; type: string; category: string; created_at: string
  }>(
    `SELECT id, title, amount::float, type, category,
            TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM-DD') as created_at
     FROM finance_items
     WHERE id = ANY($1)
     ORDER BY created_at DESC`,
    [transactionIds]
  ).catch(() => [])

  if (transactions.length === 0) return null

  const lines = transactions.map(t =>
    `• #${t.id} — *${t.title}*: €${Number(t.amount).toFixed(2)} (${t.category})`
  )

  const result: ChatResult = {
    reply: `📊 *Transactiedetails:*\n${lines.join('\n')}`,
    actions: [{ type: 'finance_summary', data: { total: transactions.reduce((s, t) => s + t.amount, 0), period: 'detail', count: transactions.length } }],
    parserType: 'deterministic',
    confidence: 0.95,
    intent: 'finance_detail_followup',
  }
  await logAndStoreResponse(userContent, result)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: Domain + result extraction for session state
// ─────────────────────────────────────────────────────────────────────────────

function detectDomainFromActions(actions: AIAction[]): string | null {
  if (!actions.length) return null
  const type = actions[0].type
  if (type.startsWith('finance')) return 'finance'
  if (type.startsWith('todo')) return 'todo'
  if (type.startsWith('grocery')) return 'grocery'
  if (type.startsWith('event')) return 'event'
  if (type.startsWith('worklog') || type.startsWith('timer')) return 'worklog'
  if (type.startsWith('note')) return 'note'
  if (type.startsWith('journal')) return 'journal'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main processor
// ─────────────────────────────────────────────────────────────────────────────

export async function processChatMessage(request: ChatRequest): Promise<ChatResult> {
  const sessionKey = request.sessionKey ?? getSessionKey(request.source, request.senderPhone)
  const context = await buildChatContext(request.source, sessionKey)
  const userContent = formatUserMessageForStorage(request)

  // 0. Trigger background sync & habit extraction (non-blocking)
  triggerBackgroundSync()
  extractAndLogHabits(request.message).then(res => {
    if (res.logged.length > 0) {
      console.log(`[HabitExtractor] Auto-logged: ${res.logged.join(', ')}`)
    }
  })

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

  // 2.5. Grocery fast-path — deterministic BEFORE AI (highest priority domain)
  const groceryParse = parseIntent(request.message)

  if (groceryParse.intent === 'grocery_add' && groceryParse.confidence >= 0.85) {
    const rawTitle = String(groceryParse.params.title || request.message)
    const items = parseGroceryItems(rawTitle)

    if (items.length > 0) {
      const groceryActions: AIAction[] = items.map(title => ({
        type: 'grocery_create' as const,
        payload: { title, category: 'overig' },
      }))
      const actionResults = await executeActions(groceryActions)
      const successItems = actionResults.filter(r => r.success).map(r => (r.data as any)?.title ?? '?')

      const reply = successItems.length === 0
        ? 'Er ging iets mis bij het toevoegen aan de boodschappenlijst.'
        : successItems.length === 1
        ? `✅ Toegevoegd: *${successItems[0]}*`
        : `✅ Toegevoegd aan boodschappenlijst:\n${successItems.map(i => `• ${i}`).join('\n')}`

      const result: ChatResult = {
        reply,
        actions: mapAIResultsToStoredActions(actionResults),
        parserType: 'deterministic',
        confidence: groceryParse.confidence,
        intent: 'grocery_add',
      }
      await logAndStoreResponse(userContent, result)
      await saveSession(sessionKey, { lastDomain: 'grocery', lastResult: null })
      return result
    }
  }

  if (groceryParse.intent === 'grocery_list' && groceryParse.confidence >= 0.85) {
    const actionResults = await executeActions([{ type: 'grocery_list' as const, payload: {} }])
    const items = (actionResults[0]?.data as any[]) || []

    const reply = items.length === 0
      ? '🛒 Je boodschappenlijst is leeg.'
      : `🛒 *Boodschappenlijst* (${items.length} items):\n${items.map((i: any) => `• ${i.title}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n')}`

    const result: ChatResult = {
      reply,
      actions: mapAIResultsToStoredActions(actionResults),
      parserType: 'deterministic',
      confidence: groceryParse.confidence,
      intent: 'grocery_list',
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 2.6. Finance summary fast-path — always query DB, never rely on chat history
  const financeQueryRe = /\b(hoeveel|wat|totaal|overzicht)\b.{0,30}\b(uitgegeven|uitgaven|gespendeerd|betaald|inkomsten|verdiend|ontvangen)\b|\b(uitgaven|inkomsten|kosten|saldo)\b.{0,20}\b(vandaag|gisteren|week|maand|dit jaar)\b/i
  const periodRe = /\b(gisteren|yesterday)\b/i.test(request.message) ? 'yesterday'
    : /\b(week|afgelopen week|deze week)\b/i.test(request.message) ? 'week'
    : /\b(maand|deze maand|afgelopen maand)\b/i.test(request.message) ? 'month'
    : /\b(jaar|dit jaar|afgelopen jaar)\b/i.test(request.message) ? 'year'
    : /\bvandaag\b/i.test(request.message) ? 'today'
    : null

  if (financeQueryRe.test(request.message) && periodRe) {
    const periodSql: Record<string, string> = {
      today: `date = CURRENT_DATE`,
      yesterday: `date = CURRENT_DATE - 1`,
      week: `date >= CURRENT_DATE - INTERVAL '7 days'`,
      month: `date >= DATE_TRUNC('month', CURRENT_DATE)`,
      year: `date >= DATE_TRUNC('year', CURRENT_DATE)`,
    }
    const periodLabel: Record<string, string> = {
      today: 'vandaag', yesterday: 'gisteren', week: 'deze week', month: 'deze maand', year: 'dit jaar',
    }
    const rows = await query<{ type: string; total: number; count: number; ids: string }>(
      `SELECT type, SUM(amount)::float as total, COUNT(*)::int as count,
              STRING_AGG(id::text, ',') as ids
       FROM finance_items WHERE ${periodSql[periodRe]} GROUP BY type`
    ).catch(() => [])

    if (rows.length > 0) {
      const uitgaven = rows.find(r => r.type === 'expense' || r.type === 'uitgave')
      const inkomsten = rows.find(r => r.type === 'inkomst' || r.type === 'income')
      const parts: string[] = []
      if (uitgaven) parts.push(`💸 Uitgaven: €${Number(uitgaven.total).toFixed(2)} (${uitgaven.count}x)`)
      if (inkomsten) parts.push(`💰 Inkomsten: €${Number(inkomsten.total).toFixed(2)} (${inkomsten.count}x)`)

      const allIds = rows.flatMap(r => r.ids?.split(',').map(Number) ?? []).filter(Boolean)
      const transactionIds = allIds.slice(0, 20)

      const result: ChatResult = {
        reply: `📊 *Financiën ${periodLabel[periodRe]}:*\n${parts.join('\n')}\n\n_Typ "details" voor transactienummers._`,
        actions: [{ type: 'finance_summary', data: { total: (uitgaven?.total ?? 0) + (inkomsten?.total ?? 0), period: periodRe, count: rows.reduce((s, r) => s + r.count, 0) } }],
        parserType: 'deterministic',
        confidence: 0.95,
        intent: 'finance_summary',
      }
      await logAndStoreResponse(userContent, result)
      await saveSession(sessionKey, { lastDomain: 'finance', lastResult: { domain: 'finance', period: periodRe, transactionIds } })
      return result
    }
  }

  // 2.7. Follow-up resolver — "meer info", "details", "transactienummer"
  if (isFollowUpMessage(request.message)) {
    const session = await loadSession(sessionKey)
    if (session?.lastDomain === 'finance' && session.lastResult?.transactionIds?.length) {
      const followUp = await handleFinanceFollowUp(session.lastResult.transactionIds, sessionKey, userContent)
      if (followUp) return followUp
    }
  }

  // 3. AI Processing
  const aiResult = await parseCommandWithAI(request.message, sessionKey)
  const deterministicIntent = parseIntent(request.message)

  // Rule-based fallback if AI is uncertain
  if (!aiResult || aiResult.confidence < 0.4) {
    const fallback = deterministicIntent
    if (fallback.intent !== 'unknown' && fallback.confidence >= 0.8) {
      let actions: AIAction[] = []
      let summary = ''

      if (fallback.intent === 'grocery_add') {
        const rawTitle = String(fallback.params.title || request.message)
        const items = parseGroceryItems(rawTitle)
        actions = items.map(title => ({ type: 'grocery_create' as const, payload: { title, category: 'overig' } }))
        summary = items.length === 1
          ? `✅ Toegevoegd: *${items[0]}*`
          : `✅ Toegevoegd:\n${items.map(i => `• ${i}`).join('\n')}`
      } else if (fallback.intent === 'todo_add') {
        actions = [{
          type: 'todo_create',
          payload: {
            title: String(fallback.params.title || request.message),
            priority: (fallback.params.priority as any) || 'medium',
            due_date: fallback.params.due_date as string,
            category: fallback.params.category as string,
          },
        }]
        summary = `📝 Taak toegevoegd: *${fallback.params.title || request.message}*`
      } else if (fallback.intent === 'grocery_list') {
        const actionResults = await executeActions([{ type: 'grocery_list' as const, payload: {} }])
        const items = actionResults[0]?.data as any[] || []
        const reply = items.length === 0
          ? '🛒 Je boodschappenlijst is leeg.'
          : `🛒 *Boodschappenlijst:*\n${items.map((i: any) => `• ${i.title}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n')}`

        const result: ChatResult = {
          reply,
          actions: mapAIResultsToStoredActions(actionResults),
          parserType: 'deterministic',
          confidence: fallback.confidence,
          intent: fallback.intent,
        }
        await logAndStoreResponse(userContent, result)
        return result
      }

      if (actions.length > 0) {
        const actionResults = await executeActions(actions)
        const result: ChatResult = {
          reply: summary,
          actions: mapAIResultsToStoredActions(actionResults, summary),
          parserType: 'deterministic',
          confidence: fallback.confidence,
          intent: fallback.intent,
        }
        await logAndStoreResponse(userContent, result)
        return result
      }
    }
  }

  if (!aiResult || aiResult.confidence < 0.4) {
    const result: ChatResult = {
      reply: 'Ik twijfel wat je precies bedoelt. Zeg erbij of dit voor je todo\'s, boodschappen, agenda, werklog, financiën of memory is, dan pak ik het direct goed op.',
      actions: [{ type: 'clarification_requested', data: { reason: 'low_confidence' } }],
      parserType: 'clarification',
      confidence: 0.2,
      intent: 'clarify',
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // Truthfulness fallback: if the AI claims certainty but produced no action for a clear create command,
  // execute the deterministic parser instead of returning a ghost success message.
  if (
    aiResult.actions.length === 0 &&
    ['todo_add', 'grocery_add', 'event_add'].includes(deterministicIntent.intent) &&
    deterministicIntent.confidence >= 0.85
  ) {
    const fallbackActions = buildFallbackActionsFromIntent(deterministicIntent, request.message)
    if (fallbackActions.length > 0) {
      const actionResults = await executeActions(fallbackActions)
      const storedActions = mapAIResultsToStoredActions(actionResults)
      const failedActions = actionResults.filter(result => !result.success)

      const result: ChatResult = {
        reply: failedActions.length === 0
          ? buildFallbackSummary(deterministicIntent, actionResults, request.message)
          : `❌ De actie kon niet worden uitgevoerd (${failedActions.map(result => result.error ?? 'onbekende fout').join('; ')}).`,
        actions: storedActions,
        parserType: 'deterministic',
        confidence: deterministicIntent.confidence,
        intent: deterministicIntent.intent,
      }
      await logAndStoreResponse(userContent, result)
      return result
    }
  }

  if (
    aiResult.actions.length === 0 &&
    ['todo_list', 'event_list'].includes(deterministicIntent.intent) &&
    deterministicIntent.confidence >= 0.85
  ) {
    const result = await buildDeterministicListResponse(deterministicIntent)
    if (result) {
      await logAndStoreResponse(userContent, result)
      return result
    }
  }

  // 3.5. Auto-fix confirmation contract:
  // Als summary een voorstel/vraag is maar requires_confirmation niet is gezet,
  // en er zijn actions aanwezig → force confirmation.
  const summaryIsProposal = /\b(wil je|zal ik|moet ik|zullen we|kan ik|wil je dat ik)\b/i.test(aiResult.summary)
  if (summaryIsProposal && !aiResult.requires_confirmation && aiResult.actions.length > 0) {
    (aiResult as any).requires_confirmation = true
  }

  // 4. Handle Memory Candidates
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
      reply: `${aiResult.summary}\n\nAntwoord met *ja* om te bevestigen of *nee* om te annuleren.`,
      actions: [{ type: 'confirmation_requested', data: { preview } }],
      parserType: 'ai',
      confidence: aiResult.confidence,
      intent: 'ai_confirm',
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 5.5. Als AI een voorstel doet maar actions leeg zijn → alleen text-reply, geen pending action
  // (Edge case: AI vraagt iets maar kan het niet automatisch uitvoeren)
  if (aiResult.requires_confirmation && aiResult.actions.length === 0) {
    const result: ChatResult = {
      reply: aiResult.summary,
      actions: [{ type: 'clarification_requested', data: { reason: 'proposal_no_actions' } }],
      parserType: 'ai',
      confidence: aiResult.confidence,
      intent: 'ai_proposal',
    }
    await logAndStoreResponse(userContent, result)
    return result
  }

  // 6. Execute Actions
  let storedActions: StoredAction[] = []
  let actionResults: ActionResult[] = []

  if (aiResult.actions.length > 0) {
    actionResults = await executeActions(aiResult.actions as any[])
    storedActions = mapAIResultsToStoredActions(actionResults, aiResult.summary)
  }

  // 6.5. Truthfulness guard: als acties faalden, overschrijf de AI-summary
  const failedActions = actionResults.filter(r => !r.success)
  if (failedActions.length > 0 && actionResults.length > 0) {
    const failedTypes = failedActions.map(r => r.type ?? 'onbekend').join(', ')
    const failReasons = failedActions.map(r => r.error ?? 'onbekende fout').join('; ')
    const successCount = actionResults.length - failedActions.length
    if (successCount === 0) {
      // All actions failed — do not claim success
      aiResult.summary = `❌ De actie kon niet worden uitgevoerd (${failReasons}). Controleer de invoer en probeer opnieuw.`
    } else {
      // Partial failure — be honest about what did and didn't work
      aiResult.summary = `${aiResult.summary}\n\n⚠️ Let op: ${failedActions.length} actie(s) mislukt (${failedTypes}): ${failReasons}`
    }
  }

  // 7. Save session state for follow-up support
  const detectedDomain = detectDomainFromActions(aiResult.actions as AIAction[])
  if (detectedDomain) {
    // For finance actions: extract transaction IDs from results
    const transactionIds = actionResults
      .filter(r => r.success && r.type?.startsWith('finance'))
      .map(r => (r.data as any)?.id)
      .filter(Boolean)

    await saveSession(sessionKey, {
      lastDomain: detectedDomain,
      lastResult: transactionIds.length
        ? { domain: detectedDomain, transactionIds, total: transactionIds.length }
        : { domain: detectedDomain },
    })
  } else {
    // Finance query (no actions, but summary mentions finance) → store for follow-up
    const isTalkingAboutFinance = /\b(uitgegeven|inkomsten|uitgaven|euro|€|factuur|transacti|betaald|saldo)\b/i.test(aiResult.summary)
    if (isTalkingAboutFinance) {
      // Fetch recent transaction IDs from today's context so follow-up can find them
      const recentIds = await query<{ id: number }>(
        `SELECT id FROM finance_items
         WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
         ORDER BY created_at DESC LIMIT 10`
      ).catch(() => [] as { id: number }[])

      if (recentIds.length > 0) {
        await saveSession(sessionKey, {
          lastDomain: 'finance',
          lastResult: {
            domain: 'finance',
            transactionIds: recentIds.map(r => r.id),
          },
        })
      }
    }
  }

  // 8. Final Result
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

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
      reply: 'Er staat niets open om te bevestigen. Typ je vraag of opdracht opnieuw.',
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
      reply: payload.aiSummary ?? '✅ Uitgevoerd.',
      actions: [{ type: 'confirmation_executed', data: { preview: payload.preview } }, ...stored],
      parserType: 'confirmation',
      confidence: 0.99,
      intent: 'confirmation_execute',
    }
  }

  return {
    reply: 'Bevestiging mislukt — de actie was niet meer geldig.',
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
    reply: '❌ Geannuleerd.',
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
      case 'note_create':
        mapped.push({ type: 'note_created', data: { id: data?.id, title: data?.title ?? 'Note' } })
        break
      case 'note_update':
        mapped.push({ type: 'note_updated', data: { id: data?.id, title: data?.title } })
        break
      case 'journal_create':
        mapped.push({ type: 'journal_created', data: { date: data?.date ?? '', content: data?.content ?? '' } })
        break
      case 'daily_plan_request':
      case 'weekly_plan_request':
        mapped.push({ type: 'plan_requested', data: { period: data?.period === 'week' ? 'week' : 'day' } })
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
      case 'grocery_create':
        mapped.push({ type: 'grocery_added', data: { id: data?.id, title: data?.title ?? 'Boodschap' } })
        break
      case 'grocery_list':
        mapped.push({ type: 'grocery_listed', data: { items: data } })
        break
    }
  }

  return mapped
}
