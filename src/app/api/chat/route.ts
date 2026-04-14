import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'
import { parseIntent, generateResponse } from '@/lib/chat-parser'
import { format } from 'date-fns'

export async function GET() {
  const db = getDb()
  const messages = db.prepare(`
    SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50
  `).all().reverse()
  return NextResponse.json({ data: (messages as Record<string, unknown>[]).map((m) => ({ ...m, actions: JSON.parse(m.actions as string || '[]') })) })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { message } = body

  if (!message?.trim()) return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })

  // Sla gebruikersbericht op
  db.prepare('INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)').run('user', message, '[]')

  const parsed = parseIntent(message)
  let actionResult: unknown = undefined
  const actions: unknown[] = []

  // Voer de intentie uit
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
        const todo = db.prepare(`
          SELECT * FROM todos WHERE completed = 0 AND title LIKE ? LIMIT 1
        `).get(`%${query}%`) as Record<string, unknown> | undefined
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
      let q = 'SELECT * FROM todos WHERE completed = 0'
      if (filter === 'vandaag' || filter === 'today') q += " AND date(due_date) = date('now')"
      else if (filter === 'deze week' || filter === 'this week') q += " AND date(due_date) <= date('now', '+7 days')"
      q += ' ORDER BY CASE priority WHEN "hoog" THEN 0 WHEN "medium" THEN 1 ELSE 2 END, due_date ASC NULLS LAST LIMIT 10'
      actionResult = db.prepare(q).all()
      actions.push({ type: 'todo_listed', data: actionResult })
      break
    }

    case 'note_add': {
      const content = String(parsed.params.content || '')
      if (content) {
        const result = db.prepare(`
          INSERT INTO notes (title, content, content_text) VALUES (?, ?, ?)
        `).run(content.slice(0, 60), content, content)
        actionResult = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid)
        actions.push({ type: 'note_created', data: actionResult })
      }
      break
    }

    case 'contact_add': {
      if (parsed.params.name) {
        const result = db.prepare(`
          INSERT INTO contacts (name, email, phone, tags) VALUES (?, ?, ?, '[]')
        `).run(
          String(parsed.params.name),
          parsed.params.email || null,
          parsed.params.phone || null
        )
        actionResult = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid)
        actions.push({ type: 'contact_created', data: actionResult })
      }
      break
    }

    case 'contact_list': {
      actionResult = db.prepare('SELECT id, name, type, email FROM contacts ORDER BY name LIMIT 10').all()
      actions.push({ type: 'contact_listed', data: actionResult })
      break
    }

    case 'finance_add_invoice': {
      const year = new Date().getFullYear()
      const count = (db.prepare("SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND strftime('%Y', created_at) = ?").get(String(year)) as { c: number }).c
      const invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`

      // Zoek contact op naam
      let contactId: number | null = null
      if (parsed.params.client) {
        const contact = db.prepare('SELECT id FROM contacts WHERE name LIKE ? LIMIT 1').get(`%${parsed.params.client}%`) as { id: number } | undefined
        contactId = contact?.id || null
      }

      const result = db.prepare(`
        INSERT INTO finance_items (type, title, amount, contact_id, status, invoice_number, due_date, category)
        VALUES ('factuur', ?, ?, ?, 'concept', ?, ?, 'overig')
      `).run(
        String(parsed.params.title || 'Nieuwe factuur'),
        parsed.params.amount || 0,
        contactId,
        invoiceNumber,
        parsed.params.due_date || null
      )
      actionResult = db.prepare('SELECT * FROM finance_items WHERE id = ?').get(result.lastInsertRowid)
      actions.push({ type: 'finance_created', data: actionResult })
      break
    }

    case 'finance_add_expense': {
      const result = db.prepare(`
        INSERT INTO finance_items (type, title, amount, status, category)
        VALUES ('uitgave', ?, ?, 'betaald', ?)
      `).run(
        String(parsed.params.title || 'Uitgave'),
        parsed.params.amount || 0,
        String(parsed.params.category || 'overig')
      )
      actionResult = db.prepare('SELECT * FROM finance_items WHERE id = ?').get(result.lastInsertRowid)
      actions.push({ type: 'finance_created', data: actionResult })
      break
    }

    case 'finance_list': {
      const stats = db.prepare(`
        SELECT
          SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as amount,
          COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open
        FROM finance_items
      `).get() as { amount: number; open: number }
      actionResult = stats
      actions.push({ type: 'finance_listed', data: stats })
      break
    }

    case 'habit_log': {
      const today = format(new Date(), 'yyyy-MM-dd')
      const habitName = String(parsed.params.habit_name || '')
      let habit: Record<string, unknown> | undefined

      if (habitName) {
        habit = db.prepare('SELECT * FROM habits WHERE name LIKE ? AND active = 1 LIMIT 1').get(`%${habitName}%`) as Record<string, unknown> | undefined
      }
      if (!habit) {
        habit = db.prepare('SELECT * FROM habits WHERE active = 1 ORDER BY created_at LIMIT 1').get() as Record<string, unknown> | undefined
      }

      if (habit) {
        db.prepare('INSERT OR REPLACE INTO habit_logs (habit_id, logged_date) VALUES (?, ?)').run(habit.id, today)
        actions.push({ type: 'habit_logged', data: { habit, date: today } })
      }
      break
    }

    case 'memory_add': {
      const fact = String(parsed.params.fact || '')
      if (fact) {
        const key = fact.slice(0, 60)
        db.prepare('INSERT OR REPLACE INTO memories (key, value, category) VALUES (?, ?, ?)').run(key, fact, 'chat')
        actions.push({ type: 'memory_saved', data: { fact } })
      }
      break
    }

    case 'stats': {
      const todoCount = db.prepare('SELECT COUNT(*) as c FROM todos WHERE completed = 0').get() as { c: number }
      const noteCount = db.prepare('SELECT COUNT(*) as c FROM notes').get() as { c: number }
      const financeOpen = db.prepare("SELECT COUNT(*) as c, SUM(amount) as total FROM finance_items WHERE type='factuur' AND status IN ('verstuurd','verlopen')").get() as { c: number; total: number }
      actionResult = { todoCount: todoCount.c, noteCount: noteCount.c, openInvoices: financeOpen.c, openAmount: financeOpen.total || 0 }
      break
    }
  }

  const responseText = generateResponse(parsed, actionResult)

  // Stats toevoegen aan response
  let finalResponse = responseText
  if (parsed.intent === 'stats' && actionResult) {
    const r = actionResult as { todoCount: number; noteCount: number; openInvoices: number; openAmount: number }
    finalResponse += `\n\n• **${r.todoCount}** open todos\n• **${r.noteCount}** notes\n• **${r.openInvoices}** open facturen (€${r.openAmount.toFixed(2)})`
  }

  // Sla assistant response op
  db.prepare('INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)').run('assistant', finalResponse, JSON.stringify(actions))

  return NextResponse.json({
    response: finalResponse,
    intent: parsed.intent,
    actions,
  })
}
