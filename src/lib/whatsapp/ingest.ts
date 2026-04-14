/**
 * WhatsApp ingest engine.
 * Hergebruikt de bestaande chat/AI logica en slaat resultaten op in de DB.
 * Dit is de brug tussen het WhatsApp-kanaal en het brein van de app.
 */

import getDb from '@/lib/db'
import { parseIntent, generateResponse } from '@/lib/chat-parser'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { generateAIResponse } from '@/lib/ai/generate-response'
import type { IngestRequest, IngestResponse } from './types'

export async function ingestMessage(req: IngestRequest): Promise<IngestResponse> {
  const { message, source, senderPhone, senderName } = req
  const db = getDb()

  // Sla inkomend bericht op als chat_message (met source context)
  db.prepare(
    'INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)'
  ).run('user', `[${source}${senderName ? ` - ${senderName}` : ''}] ${message}`, '[]')

  const parsed = parseIntent(message)
  let assistantMessage = ''
  let parserType = 'rule'
  let confidence = parsed.confidence ?? 0.5
  let actionsJson = '[]'

  const useAI = !process.env.OPENAI_API_KEY
    ? false
    : parsed.intent === 'unknown' || confidence < 0.75

  if (!useAI) {
    // Rule-based pad — zelfde logica als de chat route
    parserType = 'rule'
    let actionResult: unknown = undefined
    const actions: unknown[] = []

    switch (parsed.intent) {
      case 'todo_add': {
        if (parsed.params.title) {
          const result = db.prepare(`
            INSERT INTO todos (title, category, priority, due_date)
            VALUES (?, ?, ?, ?)
          `).run(
            String(parsed.params.title),
            parsed.params.category || 'overig',
            parsed.params.priority || 'medium',
            parsed.params.due_date || null
          )
          actionResult = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid)
          actions.push({ type: 'todo_created', data: actionResult })
        }
        break
      }
      case 'todo_complete': {
        const query = String(parsed.params.query || '')
        if (query) {
          const todo = db.prepare(
            'SELECT * FROM todos WHERE completed = 0 AND title LIKE ? LIMIT 1'
          ).get(`%${query}%`) as Record<string, unknown> | undefined
          if (todo) {
            db.prepare(`UPDATE todos SET completed = 1, completed_at = datetime('now') WHERE id = ?`).run(todo.id)
            actionResult = todo
            actions.push({ type: 'todo_completed', data: todo })
          }
        }
        break
      }
      case 'todo_list': {
        const filter = String(parsed.params.filter || '')
        let q = 'SELECT id, title, priority, due_date FROM todos WHERE completed = 0'
        if (filter === 'vandaag' || filter === 'today') q += " AND date(due_date) = date('now')"
        q += " ORDER BY CASE priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END LIMIT 8"
        actionResult = db.prepare(q).all()
        actions.push({ type: 'todo_listed', data: actionResult })
        break
      }
      case 'note_add': {
        const content = String(parsed.params.content || '')
        if (content) {
          const result = db.prepare(
            'INSERT INTO notes (title, content, content_text) VALUES (?, ?, ?)'
          ).run(content.slice(0, 60), content, content)
          actionResult = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid)
          actions.push({ type: 'note_created', data: actionResult })
        }
        break
      }
      case 'finance_add_expense': {
        const result = db.prepare(
          "INSERT INTO finance_items (type, title, amount, status, category) VALUES ('uitgave', ?, ?, 'betaald', ?)"
        ).run(
          String(parsed.params.title || 'Uitgave'),
          parsed.params.amount || 0,
          String(parsed.params.category || 'overig')
        )
        actionResult = db.prepare('SELECT * FROM finance_items WHERE id = ?').get(result.lastInsertRowid)
        actions.push({ type: 'finance_created', data: actionResult })
        break
      }
      case 'stats': {
        const todoCount = db.prepare('SELECT COUNT(*) as c FROM todos WHERE completed = 0').get() as { c: number }
        const financeOpen = db.prepare(
          "SELECT COUNT(*) as c, SUM(amount) as total FROM finance_items WHERE type='factuur' AND status IN ('verstuurd','verlopen')"
        ).get() as { c: number; total: number }
        actionResult = { todoCount: todoCount.c, openInvoices: financeOpen.c, openAmount: financeOpen.total || 0 }
        break
      }
    }

    let responseText = generateResponse(parsed, actionResult)
    if (parsed.intent === 'stats' && actionResult) {
      const r = actionResult as { todoCount: number; openInvoices: number; openAmount: number }
      responseText += `\n\n📋 ${r.todoCount} open todos\n💸 ${r.openInvoices} open facturen (€${r.openAmount.toFixed(2)})`
    }

    assistantMessage = stripMarkdown(responseText)
    actionsJson = JSON.stringify(actions)
  } else {
    // AI pad
    parserType = 'ai'
    const aiResult = await parseCommandWithAI(message)

    if (!aiResult) {
      parserType = 'fallback'
      assistantMessage = stripMarkdown(generateResponse(parsed, undefined))
      confidence = 0.1
    } else {
      confidence = aiResult.confidence

      // Memory candidates opslaan
      if (aiResult.memory_candidates) {
        for (const candidate of aiResult.memory_candidates) {
          if (candidate.confidence >= 0.7) {
            db.prepare(`
              INSERT INTO memory_log (key, value, category, confidence) VALUES (?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, last_reinforced_at = datetime('now'), updated_at = datetime('now')
            `).run(candidate.key, candidate.value, candidate.category, candidate.confidence)
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

  // Sla assistant reply op
  db.prepare(
    'INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)'
  ).run('assistant', assistantMessage, actionsJson)

  // Conversation log
  db.prepare(`
    INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    `[${source}${senderPhone ? ` ${senderPhone}` : ''}] ${message}`,
    assistantMessage,
    parserType,
    confidence,
    actionsJson
  )

  return {
    reply: assistantMessage,
    actions: JSON.parse(actionsJson),
    parserType,
    confidence,
  }
}

/**
 * Verwijder markdown opmaak voor WhatsApp plain text.
 * WhatsApp ondersteunt *bold* en _italic_ maar geen **double** of `code`.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')   // **bold** → *bold*
    .replace(/__(.*?)__/g, '_$1_')         // __bold__ → _bold_
    .replace(/`([^`]+)`/g, '$1')           // `code` → code
    .replace(/#{1,6}\s/g, '')              // headers verwijderen
    .trim()
}
