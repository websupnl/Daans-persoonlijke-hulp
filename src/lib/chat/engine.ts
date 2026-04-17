import { format } from 'date-fns'
import { execute, query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { buildChatContext, getSessionKey } from './context'
import { DEFAULT_PROFILE_FACTS } from './default-profile'
import { cleanWhitespace, compactNormalized, includesAny, looseEntityMatch, normalizeDutch } from './normalize'
import { inferMomentLabel, parseDate, parseDateTime, parseDurationMinutes, parseMoneyAmount } from './time'
import type {
  ChatAction,
  ChatPlan,
  ChatQuery,
  ChatRequest,
  ChatResult,
  ChatRuntimeContext,
  EventType,
  Priority,
  ProjectStatus,
  StoredAction,
  WorkContext,
} from './types'

const SMALL_TALK_RESPONSES: Record<string, string> = {
  hey: 'Ik ben er. Zeg gewoon wat je wilt weten, loggen of plannen.',
  hoi: 'Ik ben er. Gooi het maar in normale taal.',
  hallo: 'Ik luister. Wat wil je doen?',
}

interface PendingPayload {
  engine: 'chat' | 'ai'
  preview: string
  actions?: ChatAction[]
  aiSummary?: string
  aiActions?: unknown[]
}

export async function processChatMessage(request: ChatRequest): Promise<ChatResult> {
  const sessionKey = request.sessionKey ?? getSessionKey(request.source, request.senderPhone)
  const context = await buildChatContext(request.source, sessionKey)
  const userContent = formatUserMessageForStorage(request)

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

export function planMessage(message: string, context: ChatRuntimeContext): ChatPlan {
  const normalized = normalizeDutch(message)

  if (isConfirmation(normalized)) {
    return {
      kind: 'confirmation',
      confidence: 0.98,
      primaryIntent: 'confirmation_yes',
      actions: [],
    }
  }

  if (isCancellation(normalized)) {
    return {
      kind: 'confirmation',
      confidence: 0.98,
      primaryIntent: 'confirmation_no',
      actions: [],
    }
  }

  if (isSmallTalk(normalized)) {
    return {
      kind: 'small_talk',
      confidence: 0.95,
      primaryIntent: 'small_talk',
      actions: [],
    }
  }

  const correctionPlan = detectCorrectionPlan(normalized, context)
  if (correctionPlan) return correctionPlan

  const narrativePlan = detectNarrativePlan(message, normalized, context)
  if (narrativePlan) return narrativePlan

  const memoryPlan = detectMemoryPlan(normalized)
  if (memoryPlan) return memoryPlan

  const readPlan = detectReadPlan(normalized)
  if (readPlan) return readPlan

  const todoPlan = detectTodoPlan(message, normalized, context)
  if (todoPlan) return todoPlan

  const worklogPlan = detectWorklogPlan(message, normalized, context)
  if (worklogPlan) return worklogPlan

  const eventPlan = detectEventPlan(message, normalized, context)
  if (eventPlan) return eventPlan

  const habitPlan = detectHabitPlan(message, normalized)
  if (habitPlan) return habitPlan

  const financePlan = detectFinancePlan(message, normalized)
  if (financePlan) return financePlan

  const projectPlan = detectProjectPlan(message, normalized, context)
  if (projectPlan) return projectPlan

  const contactPlan = detectContactPlan(message, normalized)
  if (contactPlan) return contactPlan

  const memoryStorePlan = detectMemoryStorePlan(message, normalized)
  if (memoryStorePlan) return memoryStorePlan

  return {
    kind: 'unknown',
    confidence: 0.1,
    primaryIntent: 'unknown',
    actions: [],
  }
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
      reply,
      actions: [],
      parserType: 'deterministic',
      confidence: plan.confidence,
      intent: plan.primaryIntent,
    }
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
    }
  }

  if (aiResult.requires_confirmation && aiResult.actions.length > 0) {
    const preview = aiResult.summary || 'AI-actie bevestigen'
    await savePendingAction(context, {
      engine: 'ai',
      preview,
      aiSummary: aiResult.summary,
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

export async function executeChatActions(
  actions: ChatAction[],
  _context: ChatRuntimeContext
): Promise<{ actions: StoredAction[] }> {
  const stored: StoredAction[] = []

  for (const action of actions) {
    switch (action.type) {
      case 'todo_create': {
        const row = await queryOne<{ id: number }>(`
          INSERT INTO todos (title, description, priority, due_date, category, project_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          action.payload.title,
          action.payload.description ?? null,
          action.payload.priority ?? 'medium',
          action.payload.due_date ?? null,
          action.payload.category ?? 'overig',
          action.payload.project_id ?? null,
        ])

        if (row?.id) {
          await syncEntityLinks({
            sourceType: 'todo',
            sourceId: row.id,
            projectId: action.payload.project_id ?? null,
            tags: action.payload.category ? [action.payload.category] : [],
          })
          await logActivity({
            entityType: 'todo',
            entityId: row.id,
            action: 'created',
            title: action.payload.title,
            summary: 'Todo aangemaakt via chat',
            metadata: {
              priority: action.payload.priority ?? 'medium',
              due_date: action.payload.due_date ?? null,
            },
          })
        }

        stored.push({
          type: 'todo_created',
          data: {
            id: row?.id,
            title: action.payload.title,
            due_date: action.payload.due_date ?? null,
            priority: action.payload.priority,
          },
        })
        break
      }

      case 'todo_update': {
        await execute(
          `
            UPDATE todos
            SET title = COALESCE($1, title),
                priority = COALESCE($2, priority),
                due_date = COALESCE($3, due_date),
                updated_at = NOW()
            WHERE id = $4
          `,
          [action.payload.title ?? null, action.payload.priority ?? null, action.payload.due_date ?? null, action.payload.id]
        )
        const todo = await queryOne<{ title: string }>('SELECT title FROM todos WHERE id = $1 LIMIT 1', [action.payload.id])
        stored.push({
          type: 'todo_updated',
          data: {
            id: action.payload.id,
            title: todo?.title ?? action.payload.title,
            priority: action.payload.priority,
            due_date: action.payload.due_date ?? null,
          },
        })
        break
      }

      case 'todo_complete': {
        const todo = await queryOne<{ id: number; title: string }>('SELECT id, title FROM todos WHERE id = $1 LIMIT 1', [action.payload.id])
        if (!todo) break
        await execute('UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [todo.id])
        stored.push({ type: 'todo_completed', data: { id: todo.id, title: todo.title } })
        break
      }

      case 'todo_delete': {
        const todo = await queryOne<{ id: number; title: string }>('SELECT id, title FROM todos WHERE id = $1 LIMIT 1', [action.payload.id])
        if (!todo) break
        await execute('DELETE FROM todos WHERE id = $1', [todo.id])
        stored.push({ type: 'todo_deleted', data: { id: todo.id, title: todo.title } })
        break
      }

      case 'todo_delete_many': {
        const rows = await query<{ title: string }>('SELECT title FROM todos WHERE id = ANY($1::int[])', [action.payload.ids])
        await execute('DELETE FROM todos WHERE id = ANY($1::int[])', [action.payload.ids])
        stored.push({ type: 'todos_deleted', data: { count: action.payload.ids.length, titles: rows.map((row) => row.title) } })
        break
      }

      case 'event_create': {
        const row = await queryOne<{ id: number }>(`
          INSERT INTO events (title, description, date, time, duration, type, project_id, contact_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          action.payload.title,
          action.payload.description ?? null,
          action.payload.date,
          action.payload.time ?? null,
          action.payload.duration ?? 60,
          action.payload.type ?? 'algemeen',
          action.payload.project_id ?? null,
          action.payload.contact_id ?? null,
        ])
        if (row?.id) {
          await syncEntityLinks({
            sourceType: 'event',
            sourceId: row.id,
            projectId: action.payload.project_id ?? null,
            contactId: action.payload.contact_id ?? null,
            tags: [action.payload.type ?? 'algemeen'],
          })
          await logActivity({
            entityType: 'event',
            entityId: row.id,
            action: 'created',
            title: action.payload.title,
            summary: 'Event aangemaakt via chat',
            metadata: { date: action.payload.date, time: action.payload.time ?? null, type: action.payload.type ?? 'algemeen' },
          })
        }
        stored.push({
          type: 'event_created',
          data: {
            id: row?.id,
            title: action.payload.title,
            date: action.payload.date,
            time: action.payload.time ?? null,
            type: action.payload.type,
          },
        })
        break
      }

      case 'event_update': {
        await execute(
          `
            UPDATE events
            SET title = COALESCE($1, title),
                date = COALESCE($2, date),
                time = COALESCE($3, time),
                type = COALESCE($4, type),
                description = COALESCE($5, description),
                updated_at = NOW()
            WHERE id = $6
          `,
          [
            action.payload.title ?? null,
            action.payload.date ?? null,
            action.payload.time ?? null,
            action.payload.type ?? null,
            action.payload.description ?? null,
            action.payload.id,
          ]
        )
        const row = await queryOne<{ title: string; date: string; time?: string | null }>(`
          SELECT title, TO_CHAR(date, 'YYYY-MM-DD') as date, time
          FROM events
          WHERE id = $1
          LIMIT 1
        `, [action.payload.id])
        if (!row) break
        stored.push({
          type: 'event_updated',
          data: { id: action.payload.id, title: row.title, date: row.date, time: row.time ?? null },
        })
        break
      }

      case 'worklog_create': {
        const row = await queryOne<{ id: number }>(`
          INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, context, date, description, project_id, source, type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'chat', $8)
          RETURNING id
        `, [
          action.payload.title,
          action.payload.duration_minutes,
          action.payload.duration_minutes,
          action.payload.context,
          action.payload.date ?? format(new Date(), 'yyyy-MM-dd'),
          action.payload.description ?? null,
          action.payload.project_id ?? null,
          action.payload.work_type ?? 'deep_work',
        ])
        stored.push({
          type: 'worklog_created',
          data: {
            id: row?.id,
            title: action.payload.title,
            duration_minutes: action.payload.duration_minutes,
            context: action.payload.context,
          },
        })
        break
      }

      case 'worklog_update_last': {
        const latest = await queryOne<{ id: number; title: string }>(`
          SELECT id, title
          FROM work_logs
          ORDER BY created_at DESC
          LIMIT 1
        `)
        if (!latest) break
        await execute(
          `
            UPDATE work_logs
            SET actual_duration_minutes = $1,
                duration_minutes = $1,
                updated_at = NOW()
            WHERE id = $2
          `,
          [action.payload.duration_minutes, latest.id]
        )
        stored.push({
          type: 'worklog_updated',
          data: {
            id: latest.id,
            title: latest.title,
            duration_minutes: action.payload.duration_minutes,
          },
        })
        break
      }

      case 'habit_log': {
        const habit = await findOrCreateHabit(action.payload.habit_name, action.payload.auto_create === true)
        if (!habit) break
        await execute(
          `
            INSERT INTO habit_logs (habit_id, logged_date, note)
            VALUES ($1, CURRENT_DATE, $2)
            ON CONFLICT(habit_id, logged_date) DO UPDATE SET note = COALESCE(EXCLUDED.note, habit_logs.note)
          `,
          [habit.id, action.payload.note ?? null]
        )
        stored.push({ type: 'habit_logged', data: { habit_id: habit.id, habit_name: habit.name } })
        break
      }

      case 'finance_create_expense': {
        const row = await queryOne<{ id: number }>(`
          INSERT INTO finance_items (type, title, amount, category, description, status)
          VALUES ('uitgave', $1, $2, $3, $4, 'betaald')
          RETURNING id
        `, [action.payload.title, action.payload.amount, action.payload.category ?? 'overig', action.payload.description ?? null])
        stored.push({ type: 'finance_created', data: { id: row?.id, title: action.payload.title, amount: action.payload.amount, kind: 'uitgave' } })
        break
      }

      case 'finance_create_invoice': {
        const row = await queryOne<{ id: number }>(`
          INSERT INTO finance_items (type, title, amount, status, due_date, category)
          VALUES ('factuur', $1, $2, $3, $4, 'overig')
          RETURNING id
        `, [
          action.payload.title,
          action.payload.amount ?? 0,
          action.payload.status ?? 'concept',
          action.payload.due_date ?? null,
        ])
        stored.push({ type: 'finance_created', data: { id: row?.id, title: action.payload.title, amount: action.payload.amount ?? 0, kind: 'factuur' } })
        break
      }

      case 'project_create': {
        const row = await queryOne<{ id: number }>('INSERT INTO projects (title, description) VALUES ($1, $2) RETURNING id', [
          action.payload.title,
          action.payload.description ?? null,
        ])
        stored.push({ type: 'project_created', data: { id: row?.id, title: action.payload.title } })
        break
      }

      case 'project_update': {
        await execute(
          `
            UPDATE projects
            SET title = COALESCE($1, title),
                status = COALESCE($2, status),
                updated_at = NOW()
            WHERE id = $3
          `,
          [action.payload.title ?? null, action.payload.status ?? null, action.payload.id]
        )
        const row = await queryOne<{ title: string; status: ProjectStatus }>('SELECT title, status FROM projects WHERE id = $1 LIMIT 1', [action.payload.id])
        if (!row) break
        stored.push({ type: 'project_updated', data: { id: action.payload.id, title: row.title, status: row.status } })
        break
      }

      case 'contact_create': {
        const row = await queryOne<{ id: number }>(`
          INSERT INTO contacts (name, company, email, phone)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [action.payload.name, action.payload.company ?? null, action.payload.email ?? null, action.payload.phone ?? null])
        stored.push({ type: 'contact_created', data: { id: row?.id, name: action.payload.name, company: action.payload.company ?? null } })
        break
      }

      case 'timeline_log': {
        await logActivity({
          entityType: 'timeline',
          action: action.payload.category ?? 'noted',
          title: action.payload.title,
          summary: action.payload.summary,
        })
        stored.push({ type: 'timeline_logged', data: { title: action.payload.title, summary: action.payload.summary, category: action.payload.category } })
        break
      }

      case 'memory_store': {
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
          [action.payload.key, action.payload.value, action.payload.category, action.payload.confidence]
        )
        stored.push({ type: 'memory_saved', data: { key: action.payload.key, value: action.payload.value, category: action.payload.category } })
        break
      }
    }
  }

  return { actions: stored }
}

function formatExecutionReply(actions: StoredAction[], suggestion?: string): string {
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
    }
  }

  if (lines.length === 0) {
    lines.push('Ik heb het verwerkt.')
  }

  if (suggestion) {
    lines.push(`\n${suggestion}`)
  }

  return lines.join('\n')
}

function detectMemoryPlan(normalized: string): ChatPlan | null {
  if (/\b(wie ben ik|wat weet je (nog )?over mij|wat weet je nog meer|wat weet je over mijn bedrijven|wat weet je over webs?up|wat doe ik bij bouma|welke projecten lopen er nu)\b/.test(normalized)) {
    let topic: string | undefined
    if (normalized.includes('websup')) topic = 'WebsUp'
    else if (normalized.includes('bouma')) topic = 'Bouma'
    else if (normalized.includes('bedrijven')) topic = 'bedrijven'
    else if (normalized.includes('projecten')) topic = 'projecten'

    return {
      kind: 'question',
      confidence: 0.95,
      primaryIntent: 'memory_profile',
      actions: [],
      query: { type: 'memory_profile', topic },
    }
  }

  return null
}

function detectReadPlan(normalized: string): ChatPlan | null {
  if (/\b(wat staat( er)? nog open|toon open todos|toon mijn todos|open taken|mijn taken|wat moet ik nog)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.95,
      primaryIntent: 'todo_list',
      actions: [],
      query: { type: 'todo_list', filter: normalized.includes('vandaag') ? 'today' : normalized.includes('week') ? 'week' : 'open' },
    }
  }

  if (/\b(toon .*agenda|agenda deze week|agenda vandaag|toon mijn agenda|wat staat er in mijn agenda)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.94,
      primaryIntent: 'agenda_list',
      actions: [],
      query: {
        type: 'agenda_list',
        filter: normalized.includes('morgen') ? 'tomorrow' : normalized.includes('vandaag') ? 'today' : 'week',
      },
    }
  }

  if (/\b(hoeveel gewerkt vandaag|werklog overzicht|toon werklog|toon werklogs|werkuren vandaag|hoeveel heb ik vandaag gewerkt)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.94,
      primaryIntent: 'worklog_summary',
      actions: [],
      query: { type: 'worklog_summary', period: normalized.includes('week') ? 'week' : 'today' },
    }
  }

  if (/\b(toon mijn financien|toon mijn financiën|wat heb ik deze week uitgegeven|hoeveel heb ik deze week uitgegeven|hoeveel heb ik vandaag uitgegeven|toon mijn uitgaven|toon mijn financien)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.94,
      primaryIntent: 'finance_summary',
      actions: [],
      query: {
        type: 'finance_summary',
        period: normalized.includes('week') ? 'week' : normalized.includes('vandaag') ? 'today' : 'month',
      },
    }
  }

  if (/\b(welke projecten lopen er nu|toon projecten|toon mijn projecten|projecten waar ik nog op wacht)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.92,
      primaryIntent: 'project_list',
      actions: [],
      query: { type: 'project_list', filter: normalized.includes('wacht') ? 'active' : 'all' },
    }
  }

  if (/\b(bij wie hoort|wie is .* ook alweer|toon contact van)\b/.test(normalized)) {
    const queryText = normalized
      .replace(/\b(bij wie hoort|wie is|ook alweer|toon contact van)\b/g, '')
      .trim()
    return {
      kind: 'question',
      confidence: 0.88,
      primaryIntent: 'contact_lookup',
      actions: [],
      query: { type: 'contact_lookup', query: queryText },
    }
  }

  return null
}

function detectTodoPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (/\b(maak dit belangrijk|maak die belangrijk|zet dit op belangrijk)\b/.test(normalized)) {
    const todo = resolveLastTodo(context)
    if (!todo || !todo.id) {
      return {
        kind: 'correction',
        confidence: 0.72,
        primaryIntent: 'todo_update_priority',
        actions: [],
        clarification: 'Ik weet niet welke taak je bedoelt. Noem even de taaknaam, dan zet ik hem op belangrijk.',
      }
    }
    return {
      kind: 'correction',
      confidence: 0.9,
      primaryIntent: 'todo_update_priority',
      actions: [{ type: 'todo_update', payload: { id: todo.id, priority: 'hoog' } }],
    }
  }

  if (/\b(verwijder alle data)\b/.test(normalized)) {
    return {
      kind: 'command',
      confidence: 0.95,
      primaryIntent: 'dangerous_delete_all_data',
      actions: [],
      clarification: 'Die actie is te destructief om zomaar vanuit de chat uit te voeren. Doe dit liever via een expliciete beheerflow.',
    }
  }

  if (/\b(verwijder alles|wis alles|gooi alles weg)\b/.test(normalized) && /\b(todo|taak|taken)\b/.test(normalized)) {
    return {
      kind: 'command',
      confidence: 0.96,
      primaryIntent: 'todo_delete_all',
      actions: [{ type: 'todo_delete_many', payload: { ids: context.openTodos.map((todo) => todo.id) } }],
      requiresConfirmation: true,
      confirmationPreview: `Ik ga ${context.openTodos.length} open taken verwijderen.`,
    }
  }

  if (/\b(verwijder|wis|gooi weg|haal weg)\b/.test(normalized) && /\b(todo|taak|die van)\b/.test(normalized)) {
    const queryText = extractSubjectAfterDelete(message, normalized)
    const matches = context.openTodos.filter((todo) => looseEntityMatch(queryText, todo.title) || normalizeDutch(todo.title).includes(normalizeDutch(queryText)))
    if (matches.length === 0) {
      return {
        kind: 'command',
        confidence: 0.7,
        primaryIntent: 'todo_delete',
        actions: [],
        clarification: `Ik vond geen open taak die past bij "${queryText}".`,
      }
    }
    if (matches.length > 1) {
      return {
        kind: 'command',
        confidence: 0.76,
        primaryIntent: 'todo_delete',
        actions: [],
        clarification: `Ik vond meerdere taken voor "${queryText}". Zeg even welke je bedoelt.`,
      }
    }
    return {
      kind: 'command',
      confidence: 0.9,
      primaryIntent: 'todo_delete',
      actions: [{ type: 'todo_delete', payload: { id: matches[0].id } }],
      requiresConfirmation: true,
      confirmationPreview: `Ik ga taak "${matches[0].title}" verwijderen.`,
    }
  }

  if (/\b(zet in todo|zet op todo|todo\b|taak\b|herinner me)\b/.test(normalized)) {
    const title = cleanTodoTitle(message)
    if (!title) return null
    const dueDate = parseDate(normalized, context.now)
    return {
      kind: 'command',
      confidence: 0.92,
      primaryIntent: 'todo_create',
      actions: [{
        type: 'todo_create',
        payload: {
          title,
          due_date: dueDate,
          priority: inferPriority(normalized),
          category: inferCategory(normalized),
        },
      }],
    }
  }

  return null
}

function detectEventPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (/\b(verplaats|verschuif)\b/.test(normalized) && /\b(afspraak|meeting|agenda|event|die afspraak)\b/.test(normalized)) {
    const event = resolveLastEvent(context)
    if (!event || !event.id) {
      return {
        kind: 'command',
        confidence: 0.74,
        primaryIntent: 'event_move',
        actions: [],
        clarification: 'Ik weet niet welke afspraak je wilt verplaatsen. Noem de afspraak even, dan pak ik hem.',
      }
    }
    const parsed = parseDateTime(normalized, context.now)
    if (!parsed.date) {
      return {
        kind: 'command',
        confidence: 0.72,
        primaryIntent: 'event_move',
        actions: [],
        clarification: 'Ik snap nog niet naar welke datum of tijd ik de afspraak moet verplaatsen.',
      }
    }
    return {
      kind: 'command',
      confidence: 0.9,
      primaryIntent: 'event_move',
      actions: [{
        type: 'event_update',
        payload: {
          id: event.id,
          date: parsed.date,
          time: parsed.time ?? null,
        },
      }],
    }
  }

  const looksLikeEvent = includesAny(normalized, ['agenda', 'meeting', 'afspraak', 'vergadering', 'call', 'deadline', 'herinner'])
  if (!looksLikeEvent) return null

  const parsedDateTime = parseDateTime(normalized, context.now)
  const title = cleanEventTitle(message)
  const type = inferEventType(normalized)

  if (!title) return null

  const hasExplicitScheduleVerb = /\b(zet|plan|maak|agendeer|verplaats)\b/.test(normalized) || normalized.includes('herinner me')
  const hasTemporalSignal = Boolean(parsedDateTime.date || parsedDateTime.time || inferMomentLabel(normalized))

  if (!hasExplicitScheduleVerb && hasTemporalSignal) {
    const preview = `Ik kan "${title}" in je agenda zetten${parsedDateTime.date ? ` op ${parsedDateTime.date}` : ''}${parsedDateTime.time ? ` om ${parsedDateTime.time}` : parsedDateTime.momentLabel ? ` (${parsedDateTime.momentLabel})` : ''}.`
    return {
      kind: 'informative_update',
      confidence: 0.86,
      primaryIntent: 'event_confirm',
      actions: [{
        type: 'event_create',
        payload: {
          title,
          date: parsedDateTime.date ?? format(context.now, 'yyyy-MM-dd'),
          time: parsedDateTime.time ?? null,
          type,
          moment_label: parsedDateTime.momentLabel,
        },
      }],
      requiresConfirmation: true,
      confirmationPreview: preview,
    }
  }

  if (hasExplicitScheduleVerb) {
    return {
      kind: 'command',
      confidence: 0.92,
      primaryIntent: 'event_create',
      actions: [{
        type: 'event_create',
        payload: {
          title,
          date: parsedDateTime.date ?? format(context.now, 'yyyy-MM-dd'),
          time: parsedDateTime.time ?? null,
          type,
          moment_label: parsedDateTime.momentLabel,
        },
      }],
    }
  }

  return null
}

function detectNarrativePlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  const looksNarrative = includesAny(normalized, ['daarna', 'nadat ik wakker werd', 'uit bed gegaan', 'fortnite', 'vrije dag van bouma', 'verder gegaan met deze app'])
  if (!looksNarrative) return null

  const actions: ChatAction[] = []
  const primaryDate = parseDate(normalized, context.now) ?? format(context.now, 'yyyy-MM-dd')
  const wakeTime = extractWakeTime(normalized)

  if (wakeTime) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Dagstart',
        summary: `Opgestaan om ${wakeTime}${primaryDate ? ` op ${primaryDate}` : ''}.`,
        category: 'day_start',
      },
    })
  }

  if (normalized.includes('vrij') && normalized.includes('bouma')) {
    actions.push({
      type: 'memory_store',
      payload: {
        key: 'Werkpatroon vrijdag',
        value: 'Vrijdag lijkt vaak je Bouma-vrije dag en een focusdag voor WebsUp.',
        category: 'work_pattern',
        confidence: 0.86,
      },
    })
  }

  if (normalized.includes('fortnite')) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Fortnite',
        summary: 'Los ontspanningsmoment na het opstaan.',
        category: 'recreation',
      },
    })
  }

  if (normalized.includes('deze app')) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Verder gewerkt aan deze app',
        summary: `Activiteit op ${primaryDate} binnen WebsUp-context.`,
        category: 'app_work',
      },
    })
  }

  if (actions.length === 0) return null

  const previewLines = [
    wakeTime ? `- dagstart loggen (${wakeTime})` : null,
    normalized.includes('vrij') && normalized.includes('bouma') ? '- vrijdag-context onthouden als Bouma-vrij / WebsUp-focus' : null,
    normalized.includes('fortnite') ? '- Fortnite als losse ontspanningsactiviteit op timeline zetten' : null,
    normalized.includes('deze app') ? '- activiteit aan deze app op timeline zetten' : null,
  ].filter(Boolean)

  return {
    kind: 'mixed_intent',
    confidence: 0.87,
    primaryIntent: 'rich_narrative',
    actions,
    requiresConfirmation: true,
    confirmationPreview: `Ik zie hier meerdere mogelijke assistentacties:\n${previewLines.join('\n')}`,
  }
}

function detectWorklogPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  const duration = parseDurationMinutes(normalized)
  const hasWorkSignal = includesAny(normalized, [
    'werklog',
    'werk registratie',
    'werkregistratie',
    'gewerkt',
    'meeting gehad',
    'gebeld',
    'bezig',
  ]) || (!!duration && /\b(aan|voor|bij|op|gewerkt|gebeld|meeting|project|website|app|websup|bouma)\b/.test(normalized))
  if (!hasWorkSignal) return null

  const project = findBestProject(message, context)
  const contact = findBestContact(message, context)

  if (!duration && (project || contact || /\b(website|opleveren|app|klant)\b/.test(normalized))) {
    const dateHint = parseDate(normalized, context.now) ?? inferMomentLabel(normalized) ?? 'de juiste datum'
    const subject = project?.title ?? contact?.name ?? 'dit werkmoment'
    return {
      kind: 'mixed_intent',
      confidence: 0.82,
      primaryIntent: 'worklog_missing_duration',
      actions: [],
      clarification: `Ik haal hier een werkmoment uit rond ${subject} op ${dateHint}, maar ik mis nog de duur. Als je wilt kan ik dit als werklog opslaan zodra je zegt hoe lang het duurde.`,
    }
  }

  if (!duration) return null

  const title = buildWorklogTitle(message, project?.title, contact?.name)
  const suggestion = /\b(opleveren|oplevering)\b/.test(normalized)
    ? 'Morgen opleveren klinkt als een deadline. Als je wilt zet ik daar ook direct een agenda-item of todo van.'
    : undefined

  return {
    kind: /\b(en|maar)\b/.test(normalized) && suggestion ? 'mixed_intent' : 'log_entry',
    confidence: 0.93,
    primaryIntent: 'worklog_create',
    actions: [{
      type: 'worklog_create',
      payload: {
        title,
        duration_minutes: duration,
        context: inferWorkContext(normalized, project?.title),
        date: parseDate(normalized, context.now) ?? format(context.now, 'yyyy-MM-dd'),
        project_id: project?.id ?? null,
        contact_id: contact?.id ?? null,
        work_type: inferWorkType(normalized),
      },
    }],
    suggestion,
  }
}

function detectHabitPlan(message: string, normalized: string): ChatPlan | null {
  const habitName = inferHabitName(normalized)
  if (!habitName) return null
  return {
    kind: 'status_update',
    confidence: 0.9,
    primaryIntent: 'habit_log',
    actions: [{
      type: 'habit_log',
      payload: {
        habit_name: habitName,
        note: message,
        auto_create: true,
      },
    }],
  }
}

function detectFinancePlan(message: string, normalized: string): ChatPlan | null {
  const amount = parseMoneyAmount(message)
  if (!amount) return null

  if (/\b(factuur|factureren|factuur als nog te versturen)\b/.test(normalized)) {
    return {
      kind: 'command',
      confidence: 0.88,
      primaryIntent: 'finance_invoice',
      actions: [{
        type: 'finance_create_invoice',
        payload: {
          title: cleanWhitespace(message.replace(/log deze factuur als /i, '').replace(/factuur/ig, '').trim()) || 'Factuur',
          amount,
          due_date: parseDate(normalized),
          status: 'concept',
        },
      }],
    }
  }

  if (/\b(uitgegeven|uitgave|betaald|besteed|gekost)\b/.test(normalized)) {
    const title = extractFinanceTitle(message)
    return {
      kind: 'log_entry',
      confidence: 0.9,
      primaryIntent: 'finance_expense',
      actions: [{
        type: 'finance_create_expense',
        payload: {
          title,
          amount,
          category: inferCategory(normalized),
          description: message,
        },
      }],
    }
  }

  return null
}

function detectProjectPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (/\b(maak project|nieuw project|project .* aanmaken?)\b/.test(normalized)) {
    const title = cleanWhitespace(message.replace(/maak project|nieuw project|aan/ig, '').trim())
    if (!title) return null
    return {
      kind: 'command',
      confidence: 0.88,
      primaryIntent: 'project_create',
      actions: [{ type: 'project_create', payload: { title } }],
    }
  }

  const project = findBestProject(message, context)
  if (project && /\b(opleveren|afgerond|klaar)\b/.test(normalized)) {
    return {
      kind: 'status_update',
      confidence: 0.84,
      primaryIntent: 'project_update',
      actions: [{ type: 'project_update', payload: { id: project.id, status: 'afgerond' } }],
    }
  }

  return null
}

function detectContactPlan(message: string, normalized: string): ChatPlan | null {
  if (!/\b(contact|persoon)\b/.test(normalized) || !/\b(maak|voeg)\b/.test(normalized)) return null

  const companyMatch = message.match(/\bvan\s+(.+)$/i)
  const rawName = message
    .replace(/maak|voeg|contact|aan|als/ig, ' ')
    .replace(/\bvan\s+.+$/i, ' ')
    .trim()
  const name = cleanWhitespace(rawName)
  if (!name) return null

  return {
    kind: 'command',
    confidence: 0.82,
    primaryIntent: 'contact_create',
    actions: [{
      type: 'contact_create',
      payload: {
        name,
        company: companyMatch?.[1]?.trim(),
      },
    }],
  }
}

function detectMemoryStorePlan(message: string, normalized: string): ChatPlan | null {
  if (!/\b(onthoud|sla op dat|weet dat)\b/.test(normalized)) return null
  const cleaned = cleanWhitespace(message.replace(/onthoud|sla op dat|weet dat/ig, '').trim())
  if (!cleaned) return null
  return {
    kind: 'status_update',
    confidence: 0.84,
    primaryIntent: 'memory_store',
    actions: [{
      type: 'memory_store',
      payload: {
        key: cleaned.slice(0, 60),
        value: cleaned,
        category: 'personal_context',
        confidence: 0.9,
      },
    }],
  }
}

function detectCorrectionPlan(normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (!/\b(in plaats van|eigenlijk)\b/.test(normalized)) return null
  const duration = parseDurationMinutes(normalized)
  if (!duration) return null
  if (context.recentWorklogs.length === 0) return null
  return {
    kind: 'correction',
    confidence: 0.88,
    primaryIntent: 'worklog_correct_last',
    actions: [{ type: 'worklog_update_last', payload: { duration_minutes: duration } }],
  }
}

function isConfirmation(normalized: string): boolean {
  return /^(ja|ja hoor|ja doe maar|ja graag|doe maar|bevestig|yes|ok|oke)\b/.test(normalized)
}

function isCancellation(normalized: string): boolean {
  return /^(nee|nee hoor|toch niet|laat maar|annuleer|cancel)\b/.test(normalized)
}

function isSmallTalk(normalized: string): boolean {
  return /^(hey|hoi|hallo|goedemorgen|goedemiddag|goedenavond)\b/.test(normalized)
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
    reply: 'Er stond wel een bevestiging open, maar ik kon de actie niet meer uitvoeren.',
    actions: [],
    parserType: 'confirmation',
    confidence: 0.3,
    intent: 'confirmation_failed',
  }
}

async function cancelPendingAction(context: ChatRuntimeContext): Promise<ChatResult> {
  if (!context.pendingAction) {
    return {
      reply: 'Prima, er stond niets open om te annuleren.',
      actions: [],
      parserType: 'confirmation',
      confidence: 0.5,
      intent: 'confirmation_cancel_empty',
    }
  }

  const payload = JSON.parse(context.pendingAction.payload) as PendingPayload
  await clearPendingAction(context.sessionKey)

  return {
    reply: 'Ik heb het geannuleerd. Er is niets uitgevoerd.',
    actions: [{ type: 'confirmation_cancelled', data: { preview: payload.preview } }],
    parserType: 'confirmation',
    confidence: 0.99,
    intent: 'confirmation_cancel',
  }
}

async function savePendingAction(context: ChatRuntimeContext, payload: PendingPayload): Promise<void> {
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
}

async function clearPendingAction(sessionKey: string): Promise<void> {
  await execute('DELETE FROM pending_actions WHERE session_key = $1', [sessionKey])
}

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
  const queryValue = cleanWhitespace(queryText)
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

async function findOrCreateHabit(name: string, autoCreate: boolean): Promise<{ id: number; name: string } | undefined> {
  const existing = await queryOne<{ id: number; name: string }>(`
    SELECT id, name
    FROM habits
    WHERE active = 1 AND name ILIKE $1
    LIMIT 1
  `, [`%${name}%`])

  if (existing) return existing
  if (!autoCreate) return undefined

  const inserted = await queryOne<{ id: number; name: string }>(`
    INSERT INTO habits (name, frequency, target, active)
    VALUES ($1, 'dagelijks', 1, 1)
    RETURNING id, name
  `, [name])

  return inserted
}

function findBestProject(message: string, context: ChatRuntimeContext) {
  return context.activeProjects.find((project) => looseEntityMatch(message, project.title))
}

function findBestContact(message: string, context: ChatRuntimeContext) {
  return context.contacts.find((contact) =>
    looseEntityMatch(message, contact.name) ||
    (contact.company ? looseEntityMatch(message, contact.company) : false)
  )
}

function resolveLastTodo(context: ChatRuntimeContext) {
  for (const message of [...context.recentMessages].reverse()) {
    for (const action of message.actions) {
      if (action.type === 'todo_created') {
        return { id: action.data.id ?? 0, title: action.data.title }
      }
      if (action.type === 'todo_listed' && action.data.length > 0) {
        return { id: action.data[0].id, title: action.data[0].title }
      }
    }
  }
  return context.openTodos[0]
}

function resolveLastEvent(context: ChatRuntimeContext) {
  for (const message of [...context.recentMessages].reverse()) {
    for (const action of message.actions) {
      if (action.type === 'event_created') {
        return { id: action.data.id ?? 0, title: action.data.title }
      }
      if (action.type === 'events_listed' && action.data.length > 0) {
        return { id: action.data[0].id, title: action.data[0].title }
      }
    }
  }
  return context.upcomingEvents[0]
}

function cleanTodoTitle(message: string): string {
  return cleanWhitespace(
    message
      .replace(/zet in todo dat ik/ig, '')
      .replace(/zet in todo/ig, '')
      .replace(/zet op todo/ig, '')
      .replace(/^todo\b[: ]*/i, '')
      .replace(/\bmaak dit belangrijk\b/ig, '')
      .replace(/herinner me(?: vanavond| morgen| straks)? aan/ig, '')
      .replace(/\btaak\b/ig, '')
  )
}

function cleanEventTitle(message: string): string {
  return cleanWhitespace(
    message
      .replace(/zet .*? agenda/ig, '')
      .replace(/zet in de agenda/ig, '')
      .replace(/zet in agenda/ig, '')
      .replace(/plan/ig, '')
      .replace(/\b(agenda|afspraak|vergadering|deadline|herinnering)\b/ig, '')
      .replace(/\b(vandaag|morgen|overmorgen|vanavond|vanmiddag|vanochtend|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\b/ig, '')
      .replace(/\bom\s+\d{1,2}(?::\d{2})?(?:\s*uur)?\b/ig, '')
  )
}

function buildWorklogTitle(message: string, projectTitle?: string, contactName?: string): string {
  const normalized = normalizeDutch(message)
  if (/\b(meeting|gebeld|call)\b/.test(normalized)) {
    if (contactName && projectTitle) return `Meeting met ${contactName} over ${projectTitle}`
    if (contactName) return `Meeting met ${contactName}`
  }
  if (projectTitle) return `Werk aan ${projectTitle}`
  return cleanWhitespace(
    message
      .replace(/\b(ik heb|ik was|voeg toe aan werk registratie dat ik|voeg toe aan werk uren)\b/ig, '')
      .replace(/\b\d+(?:[.,]\d+)?\s*(uur|uren|u|h|min|minuten|minuut)\b/ig, '')
  )
}

function inferEventType(normalized: string): EventType {
  if (/\b(deadline|opleveren|oplevering)\b/.test(normalized)) return 'deadline'
  if (/\b(afspraak)\b/.test(normalized)) return 'afspraak'
  if (/\b(herinner)\b/.test(normalized)) return 'herinnering'
  if (/\b(meeting|vergadering|call)\b/.test(normalized)) return 'vergadering'
  return 'algemeen'
}

function inferPriority(normalized: string): Priority {
  if (/\b(belangrijk|urgent|dringend|asap|zsm)\b/.test(normalized)) return 'hoog'
  if (/\b(later|laag|ooit)\b/.test(normalized)) return 'laag'
  return 'medium'
}

function inferCategory(normalized: string): string {
  if (/\b(factuur|betaling|financien|financiën|hosting|geld)\b/.test(normalized)) return 'financieel'
  if (/\b(werk|project|meeting|klant|bouma|websup)\b/.test(normalized)) return 'werk'
  if (/\b(sport|slaap|roken|eten)\b/.test(normalized)) return 'gezondheid'
  return 'overig'
}

function inferWorkContext(normalized: string, projectTitle?: string): WorkContext {
  if (/\b(bouma|installatie|elektra)\b/.test(normalized)) return 'Bouma'
  if (/\b(websup|camperhulp|prime animalz|website|hosting)\b/.test(normalized) || projectTitle) return 'WebsUp'
  if (/\b(studie|cursus|leren)\b/.test(normalized)) return 'studie'
  if (/\b(sport|prive|thuis)\b/.test(normalized)) return 'privé'
  return 'overig'
}

function inferWorkType(normalized: string): string {
  if (/\b(meeting|gebeld|call|gesproken)\b/.test(normalized)) return 'meeting'
  if (/\b(factuur|mail|offerte|administratie)\b/.test(normalized)) return 'admin'
  if (/\b(klussen|installeren|monteren)\b/.test(normalized)) return 'physical'
  return 'deep_work'
}

function inferHabitName(normalized: string): string | undefined {
  if (/\b(gesport|sporten|wezen sporten)\b/.test(normalized)) return 'Sporten'
  if (/\b(niet gerookt|niet roken)\b/.test(normalized)) return 'Niet roken'
  if (/\b(slecht geslapen|goed geslapen|geslapen)\b/.test(normalized)) return 'Slaap'
  if (/\b(moe vandaag|ik voel me moe)\b/.test(normalized)) return 'Energie'
  return undefined
}

function extractFinanceTitle(message: string): string {
  const after = message.match(/(?:aan|voor|bij|op)\s+(.+)$/i)
  return cleanWhitespace(after?.[1] ?? message)
}

function extractWakeTime(normalized: string): string | undefined {
  const halfMatch = normalized.match(/\bhalf\s+(\d{1,2})\b/)
  if (halfMatch) {
    const hour = (Number(halfMatch[1]) + 23) % 24
    return `${String(hour).padStart(2, '0')}:30`
  }

  const explicit = normalized.match(/\bom\s+(\d{1,2})(?::(\d{2}))?(?:\s*uur)?\b/)
  if (!explicit) return undefined
  const hour = Number(explicit[1])
  const minute = explicit[2] ? Number(explicit[2]) : 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function extractSubjectAfterDelete(message: string, normalized: string): string {
  const explicit = message.match(/(?:verwijder|wis|gooi weg|haal weg)\s+(?:alleen\s+)?(?:die van\s+)?(.+)$/i)
  if (explicit?.[1]) return cleanWhitespace(explicit[1])
  return cleanWhitespace(normalized.replace(/verwijder|wis|gooi weg|haal weg|todo|taak|taken/ig, ''))
}

function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) return `${hours} uur en ${rest} min`
  if (hours > 0) return `${hours} uur`
  return `${rest} min`
}

function formatUserMessageForStorage(request: ChatRequest): string {
  if (request.source === 'telegram') {
    const sender = request.senderName ? ` - ${request.senderName}` : ''
    return `[telegram${sender}] ${request.message}`
  }
  return request.message
}

function mapAIResultsToStoredActions(
  actionResults: Array<{ type: string; success: boolean; data?: unknown }>,
  summary?: string
): StoredAction[] {
  const mapped: StoredAction[] = []

  for (const result of actionResults) {
    if (!result.success) continue
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
    }
  }

  if (mapped.length === 0 && summary) {
    mapped.push({ type: 'fallback_answer', data: { mode: 'ai' } })
  }

  return mapped
}
