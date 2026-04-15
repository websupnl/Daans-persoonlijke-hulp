/**
 * Message ingest engine — shared by Telegram, chat, and future channels.
 * Processes a plain-text message through the rule-based + AI pipeline
 * and returns a reply string + metadata.
 */

import { query, queryOne, execute } from '@/lib/db'
import { parseIntent, generateResponse } from '@/lib/chat-parser'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { generateAIResponse } from '@/lib/ai/generate-response'

export interface IngestRequest {
  message: string
  source: 'telegram' | 'chat' | string
  senderPhone?: string
  senderName?: string
}

export interface IngestResponse {
  reply: string
  actions: unknown[]
  parserType: string
  confidence: number
}

export async function ingestMessage(req: IngestRequest): Promise<IngestResponse> {
  const { message, source, senderPhone, senderName } = req

  // Save incoming message in chat history
  await execute(
    'INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)',
    ['user', `[${source}${senderName ? ` - ${senderName}` : ''}] ${message}`, '[]']
  )

  const parsed = parseIntent(message)
  let assistantMessage = ''
  let parserType = 'rule'
  let confidence = parsed.confidence ?? 0.5
  let actionsJson = '[]'

  const useAI = !process.env.OPENAI_API_KEY
    ? false
    : parsed.intent === 'unknown' || confidence < 0.75

  if (!useAI) {
    // ── Rule-based path ──────────────────────────────────────────────────────
    parserType = 'rule'
    let actionResult: unknown = undefined
    const actions: unknown[] = []

    switch (parsed.intent) {
      case 'todo_add': {
        if (parsed.params.title) {
          const inserted = await queryOne<Record<string, unknown>>(`
            INSERT INTO todos (title, category, priority, due_date)
            VALUES ($1, $2, $3, $4) RETURNING *
          `, [
            String(parsed.params.title),
            parsed.params.category || 'overig',
            parsed.params.priority || 'medium',
            parsed.params.due_date || null,
          ])
          actionResult = inserted
          actions.push({ type: 'todo_created', data: actionResult })
        }
        break
      }
      case 'todo_complete': {
        const q = String(parsed.params.query || '')
        if (q) {
          const todo = await queryOne<Record<string, unknown>>(
            'SELECT * FROM todos WHERE completed = 0 AND title LIKE $1 LIMIT 1',
            [`%${q}%`]
          )
          if (todo) {
            await execute('UPDATE todos SET completed = 1, completed_at = NOW() WHERE id = $1', [todo.id])
            actionResult = todo
            actions.push({ type: 'todo_completed', data: todo })
          }
        }
        break
      }
      case 'todo_list': {
        const filter = String(parsed.params.filter || '')
        let sql = 'SELECT id, title, priority, due_date FROM todos WHERE completed = 0'
        if (filter === 'vandaag' || filter === 'today') sql += ' AND due_date::date = CURRENT_DATE'
        sql += " ORDER BY CASE priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END LIMIT 8"
        actionResult = await query(sql)
        actions.push({ type: 'todo_listed', data: actionResult })
        break
      }
      case 'note_add': {
        const content = String(parsed.params.content || '')
        if (content) {
          const inserted = await queryOne<Record<string, unknown>>(
            'INSERT INTO notes (title, content, content_text) VALUES ($1, $2, $3) RETURNING *',
            [content.slice(0, 60), content, content]
          )
          actionResult = inserted
          actions.push({ type: 'note_created', data: actionResult })
        }
        break
      }
      case 'finance_add_expense': {
        const inserted = await queryOne<Record<string, unknown>>(
          "INSERT INTO finance_items (type, title, amount, status, category) VALUES ('uitgave', $1, $2, 'betaald', $3) RETURNING *",
          [
            String(parsed.params.title || 'Uitgave'),
            parsed.params.amount || 0,
            String(parsed.params.category || 'overig'),
          ]
        )
        actionResult = inserted
        actions.push({ type: 'finance_created', data: actionResult })
        break
      }
      case 'stats': {
        const todoCount = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM todos WHERE completed = 0')
        const monthIncome = await queryOne<{ total: number }>(
          "SELECT SUM(amount) as total FROM finance_items WHERE type='inkomst' AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')"
        )
        const monthExpenses = await queryOne<{ total: number }>(
          "SELECT SUM(amount) as total FROM finance_items WHERE type='uitgave' AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')"
        )
        actionResult = {
          todoCount: todoCount?.c ?? 0,
          monthIncome: monthIncome?.total || 0,
          monthExpenses: monthExpenses?.total || 0,
        }
        break
      }
    }

    let responseText = generateResponse(parsed, actionResult)
    if (parsed.intent === 'stats' && actionResult) {
      const r = actionResult as { todoCount: number; monthIncome: number; monthExpenses: number }
      responseText += `\n\n📋 ${r.todoCount} open todos\n💰 Inkomsten: €${Number(r.monthIncome).toFixed(2)}\n💸 Uitgaven: €${Number(r.monthExpenses).toFixed(2)}`
    }

    assistantMessage = stripMarkdown(responseText)
    actionsJson = JSON.stringify(actions)
  } else {
    // ── AI path ──────────────────────────────────────────────────────────────
    parserType = 'ai'
    const aiResult = await parseCommandWithAI(message)

    if (!aiResult) {
      parserType = 'fallback'
      assistantMessage = stripMarkdown(generateResponse(parsed, undefined))
      confidence = 0.1
    } else {
      confidence = aiResult.confidence

      // Store memory candidates
      if (aiResult.memory_candidates) {
        for (const candidate of aiResult.memory_candidates) {
          if (candidate.confidence >= 0.7) {
            await execute(`
              INSERT INTO memory_log (key, value, category, confidence) VALUES ($1, $2, $3, $4)
              ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, last_reinforced_at = NOW(), updated_at = NOW()
            `, [candidate.key, candidate.value, candidate.category, candidate.confidence])
          }
        }
      }

      let actionResults: Awaited<ReturnType<typeof executeActions>> = []
      if (!aiResult.requires_confirmation) {
        actionResults = await executeActions(aiResult.actions)
      }

      const rawReply = generateAIResponse(aiResult, actionResults, aiResult.requires_confirmation)
      assistantMessage = stripMarkdown(rawReply)
      actionsJson = JSON.stringify(aiResult.actions)
    }
  }

  // Save assistant reply
  await execute(
    'INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)',
    ['assistant', assistantMessage, actionsJson]
  )

  // Conversation log
  await execute(`
    INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    `[${source}${senderPhone ? ` ${senderPhone}` : ''}] ${message}`,
    assistantMessage,
    parserType,
    confidence,
    actionsJson,
  ])

  return {
    reply: assistantMessage,
    actions: JSON.parse(actionsJson),
    parserType,
    confidence,
  }
}

/**
 * Strip markdown formatting for plain-text channels (Telegram supports *bold* and _italic_)
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')   // **bold** → *bold*
    .replace(/__(.*?)__/g, '_$1_')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .trim()
}
