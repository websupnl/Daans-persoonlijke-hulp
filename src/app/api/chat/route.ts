export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { parseIntent, generateResponse } from '@/lib/chat-parser'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { generateAIResponse } from '@/lib/ai/generate-response'
import { format } from 'date-fns'

export async function GET() {
  const messages = await query<Record<string, unknown>>(`
    SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50
  `)
  return NextResponse.json({ data: messages.reverse().map((m) => ({ ...m, actions: JSON.parse(m.actions as string || '[]') })) })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message } = body

  if (!message?.trim()) return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })

  // Sla gebruikersbericht op
  await execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', ['user', message, '[]'])

  const parsed = parseIntent(message)
  let assistantMessage = ''
  let parserType = 'rule'
  let confidence = 0
  let actionsJson = '[]'

  const useAI = !process.env.OPENAI_API_KEY
    ? false
    : parsed.intent === 'unknown' || (parsed.confidence ?? 0) < 0.75

  if (!useAI) {
    // Use rule-based parser
    parserType = 'rule'
    confidence = parsed.confidence ?? 0.5

    let actionResult: unknown = undefined
    const actions: unknown[] = []

    switch (parsed.intent) {
      case 'todo_add': {
        if (parsed.params.title) {
          const inserted = await queryOne<Record<string, unknown>>(`
            INSERT INTO todos (title, category, priority, due_date)
            VALUES ($1, $2, $3, $4)
            RETURNING *
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
          const todo = await queryOne<Record<string, unknown>>(`
            SELECT * FROM todos WHERE completed = 0 AND title LIKE $1 LIMIT 1
          `, [`%${q}%`])
          if (todo) {
            await execute(`UPDATE todos SET completed = 1, completed_at = NOW() WHERE id = $1`, [todo.id])
            actionResult = todo
            actions.push({ type: 'todo_completed', data: todo })
          }
        }
        break
      }

      case 'todo_list': {
        const filter = String(parsed.params.filter || '')
        let sql = 'SELECT * FROM todos WHERE completed = 0'
        if (filter === 'vandaag' || filter === 'today') sql += ' AND due_date::date = CURRENT_DATE'
        else if (filter === 'deze week' || filter === 'this week') sql += " AND due_date::date <= CURRENT_DATE + INTERVAL '7 days'"
        sql += " ORDER BY CASE priority WHEN 'hoog' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, due_date ASC NULLS LAST LIMIT 10"
        actionResult = await query(sql)
        actions.push({ type: 'todo_listed', data: actionResult })
        break
      }

      case 'note_add': {
        const content = String(parsed.params.content || '')
        if (content) {
          const inserted = await queryOne<Record<string, unknown>>(`
            INSERT INTO notes (title, content, content_text) VALUES ($1, $2, $3) RETURNING *
          `, [content.slice(0, 60), content, content])
          actionResult = inserted
          actions.push({ type: 'note_created', data: actionResult })
        }
        break
      }

      case 'contact_add': {
        if (parsed.params.name) {
          const inserted = await queryOne<Record<string, unknown>>(`
            INSERT INTO contacts (name, email, phone, tags) VALUES ($1, $2, $3, '[]') RETURNING *
          `, [
            String(parsed.params.name),
            parsed.params.email || null,
            parsed.params.phone || null,
          ])
          actionResult = inserted
          actions.push({ type: 'contact_created', data: actionResult })
        }
        break
      }

      case 'contact_list': {
        actionResult = await query('SELECT id, name, type, email FROM contacts ORDER BY name LIMIT 10')
        actions.push({ type: 'contact_listed', data: actionResult })
        break
      }

      case 'finance_add_invoice': {
        const year = new Date().getFullYear()
        const countRow = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND TO_CHAR(created_at, 'YYYY') = $1`, [String(year)])
        const count = countRow?.c ?? 0
        const invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`

        let contactId: number | null = null
        if (parsed.params.client) {
          const contact = await queryOne<{ id: number }>('SELECT id FROM contacts WHERE name LIKE $1 LIMIT 1', [`%${parsed.params.client}%`])
          contactId = contact?.id || null
        }

        const inserted = await queryOne<Record<string, unknown>>(`
          INSERT INTO finance_items (type, title, amount, contact_id, status, invoice_number, due_date, category)
          VALUES ('factuur', $1, $2, $3, 'concept', $4, $5, 'overig')
          RETURNING *
        `, [
          String(parsed.params.title || 'Nieuwe factuur'),
          parsed.params.amount || 0,
          contactId,
          invoiceNumber,
          parsed.params.due_date || null,
        ])
        actionResult = inserted
        actions.push({ type: 'finance_created', data: actionResult })
        break
      }

      case 'finance_add_expense': {
        const inserted = await queryOne<Record<string, unknown>>(`
          INSERT INTO finance_items (type, title, amount, status, category)
          VALUES ('uitgave', $1, $2, 'betaald', $3)
          RETURNING *
        `, [
          String(parsed.params.title || 'Uitgave'),
          parsed.params.amount || 0,
          String(parsed.params.category || 'overig'),
        ])
        actionResult = inserted
        actions.push({ type: 'finance_created', data: actionResult })
        break
      }

      case 'finance_list': {
        const stats = await queryOne<{ amount: number; open: number }>(`
          SELECT
            SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as amount,
            COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open
          FROM finance_items
        `)
        actionResult = stats
        actions.push({ type: 'finance_listed', data: stats })
        break
      }

      case 'habit_log': {
        const today = format(new Date(), 'yyyy-MM-dd')
        const habitName = String(parsed.params.habit_name || '')
        let habit: Record<string, unknown> | undefined

        if (habitName) {
          habit = await queryOne<Record<string, unknown>>('SELECT * FROM habits WHERE name LIKE $1 AND active = 1 LIMIT 1', [`%${habitName}%`])
        }
        if (!habit) {
          habit = await queryOne<Record<string, unknown>>('SELECT * FROM habits WHERE active = 1 ORDER BY created_at LIMIT 1')
        }

        if (habit) {
          await execute(
            'INSERT INTO habit_logs (habit_id, logged_date) VALUES ($1, $2) ON CONFLICT(habit_id, logged_date) DO UPDATE SET created_at = NOW()',
            [habit.id, today]
          )
          actions.push({ type: 'habit_logged', data: { habit, date: today } })
        }
        break
      }

      case 'memory_add': {
        const fact = String(parsed.params.fact || '')
        if (fact) {
          const key = fact.slice(0, 60)
          await execute(
            'INSERT INTO memories (key, value, category) VALUES ($1, $2, $3) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
            [key, fact, 'chat']
          )
          actions.push({ type: 'memory_saved', data: { fact } })
        }
        break
      }

      case 'worklog_add': {
        const title = String(parsed.params.title || 'Werklog')
        const durationMinutes = Number(parsed.params.duration_minutes || 60)
        const context = String(parsed.params.context || 'overig')
        const inserted = await queryOne<Record<string, unknown>>(`
          INSERT INTO work_logs (title, duration_minutes, context, source, date)
          VALUES ($1, $2, $3, 'chat', CURRENT_DATE)
          RETURNING *
        `, [title.slice(0, 120), durationMinutes, context])
        actionResult = inserted
        actions.push({ type: 'worklog_created', data: actionResult })
        break
      }

      case 'worklog_list': {
        const entries = await query<{ title: string; duration_minutes: number; context: string }>(`
          SELECT title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes, context
          FROM work_logs WHERE date = CURRENT_DATE ORDER BY created_at DESC LIMIT 8
        `)
        const totalRow = await queryOne<{ total: number }>(`
          SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) as total
          FROM work_logs WHERE date = CURRENT_DATE
        `)
        actionResult = { entries, count: entries.length, total_minutes: Number(totalRow?.total ?? 0) }
        actions.push({ type: 'worklog_listed', data: actionResult })
        break
      }

      case 'event_add': {
        const evDate = String(parsed.params.date || new Date().toISOString().split('T')[0])
        const evTitle = String(parsed.params.title || 'Nieuw event')
        const evTime = parsed.params.time ? String(parsed.params.time) : null
        const evType = String(parsed.params.type || 'algemeen')
        const inserted = await queryOne<Record<string, unknown>>(`
          INSERT INTO events (title, date, time, type)
          VALUES ($1, $2, $3, $4)
          RETURNING *, TO_CHAR(date, 'YYYY-MM-DD') as date
        `, [evTitle.slice(0, 120), evDate, evTime, evType])
        actionResult = inserted
        actions.push({ type: 'event_created', data: actionResult })
        break
      }

      case 'event_list': {
        const evs = await query<{ title: string; date: string; time?: string; type: string }>(`
          SELECT title, TO_CHAR(date, 'YYYY-MM-DD') as date, time, type
          FROM events WHERE date >= CURRENT_DATE AND date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY date ASC, time ASC NULLS LAST LIMIT 10
        `)
        actionResult = evs
        actions.push({ type: 'events_listed', data: evs })
        break
      }

      case 'stats': {
        const todoCount = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM todos WHERE completed = 0')
        const noteCount = await queryOne<{ c: number }>('SELECT COUNT(*) as c FROM notes')
        const financeOpen = await queryOne<{ c: number; total: number }>("SELECT COUNT(*) as c, SUM(amount) as total FROM finance_items WHERE type='factuur' AND status IN ('verstuurd','verlopen')")
        const workToday = await queryOne<{ total: number }>('SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes, 0)) as total FROM work_logs WHERE date = CURRENT_DATE')
        actionResult = { todoCount: todoCount?.c ?? 0, noteCount: noteCount?.c ?? 0, openInvoices: financeOpen?.c ?? 0, openAmount: financeOpen?.total || 0, workTodayMinutes: Number(workToday?.total ?? 0) }
        break
      }
    }

    let responseText = generateResponse(parsed, actionResult)

    if (parsed.intent === 'stats' && actionResult) {
      const r = actionResult as { todoCount: number; noteCount: number; openInvoices: number; openAmount: number; workTodayMinutes: number }
      const wh = Math.floor(r.workTodayMinutes / 60)
      const wm = r.workTodayMinutes % 60
      responseText += `\n\n• **${r.todoCount}** open todos\n• **${r.noteCount}** notes\n• **${r.openInvoices}** open facturen (€${Number(r.openAmount || 0).toFixed(2)})\n• **${wh}u ${wm}m** gewerkt vandaag`
    }

    assistantMessage = responseText
    actionsJson = JSON.stringify(actions)
  } else {
    // Use AI parser
    parserType = 'ai'
    const aiResult = await parseCommandWithAI(message)

    if (!aiResult) {
      // Fallback to rule-based
      parserType = 'fallback'
      assistantMessage = generateResponse(parsed, undefined)
      confidence = 0.1
    } else {
      confidence = aiResult.confidence

      // Store memory candidates if confidence is high enough
      if (aiResult.memory_candidates) {
        for (const candidate of aiResult.memory_candidates) {
          if (candidate.confidence >= 0.7) {
            await execute(`
              INSERT INTO memory_log (key, value, category, confidence)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, last_reinforced_at = NOW(), updated_at = NOW()
            `, [candidate.key, candidate.value, candidate.category, candidate.confidence])
          }
        }
      }

      // Execute actions
      const shouldExecute = !aiResult.requires_confirmation
      let actionResults: Awaited<ReturnType<typeof executeActions>> = []

      if (shouldExecute) {
        actionResults = await executeActions(aiResult.actions)
      }

      assistantMessage = generateAIResponse(aiResult, actionResults, aiResult.requires_confirmation)
      actionsJson = JSON.stringify(aiResult.actions)
    }
  }

  // Sla assistant response op
  await execute('INSERT INTO chat_messages (role, content, actions) VALUES ($1, $2, $3)', ['assistant', assistantMessage, actionsJson])

  // Sla op in conversation_log
  await execute(`
    INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
    VALUES ($1, $2, $3, $4, $5)
  `, [message, assistantMessage, parserType, confidence, actionsJson])

  return NextResponse.json({
    response: assistantMessage,
    intent: parsed.intent,
    actions: JSON.parse(actionsJson),
  })
}
