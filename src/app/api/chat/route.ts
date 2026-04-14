import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'
import { parseIntent, generateResponse } from '@/lib/chat-parser'
import { format } from 'date-fns'

export async function GET() {
  const db = await getDb()
  const result = await db.execute(`SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50`)
  const messages = toRows(result).reverse()
  return NextResponse.json({ data: messages.map((m) => ({ ...m, actions: JSON.parse(m.actions as string || '[]') })) })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { message } = body

  if (!message?.trim()) return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })

  await db.execute({ sql: 'INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)', args: ['user', message, '[]'] })

  const parsed = parseIntent(message)
  let actionResult: unknown = undefined
  const actions: unknown[] = []

  switch (parsed.intent) {
    case 'todo_add': {
      if (parsed.params.title) {
        const r = await db.execute({
          sql: `INSERT INTO todos (title, category, priority, due_date) VALUES (?, ?, ?, ?)`,
          args: [
            String(parsed.params.title),
            parsed.params.category || 'overig',
            parsed.params.priority || 'medium',
            parsed.params.due_date || null,
          ],
        })
        actionResult = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
        actions.push({ type: 'todo_created', data: actionResult })
      }
      break
    }

    case 'todo_complete': {
      const query = String(parsed.params.query || '')
      if (query) {
        const todo = toRow(await db.execute({ sql: `SELECT * FROM todos WHERE completed = 0 AND title LIKE ? LIMIT 1`, args: [`%${query}%`] }))
        if (todo) {
          await db.execute({ sql: `UPDATE todos SET completed = 1, completed_at = datetime('now') WHERE id = ?`, args: [todo.id as number] })
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
      q += ' ORDER BY CASE priority WHEN "hoog" THEN 0 WHEN "medium" THEN 1 ELSE 2 END, due_date ASC LIMIT 10'
      actionResult = toRows(await db.execute(q))
      actions.push({ type: 'todo_listed', data: actionResult })
      break
    }

    case 'note_add': {
      const content = String(parsed.params.content || '')
      if (content) {
        const r = await db.execute({
          sql: `INSERT INTO notes (title, content, content_text) VALUES (?, ?, ?)`,
          args: [content.slice(0, 60), content, content],
        })
        actionResult = toRow(await db.execute({ sql: 'SELECT * FROM notes WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
        actions.push({ type: 'note_created', data: actionResult })
      }
      break
    }

    case 'contact_add': {
      if (parsed.params.name) {
        const r = await db.execute({
          sql: `INSERT INTO contacts (name, email, phone, tags) VALUES (?, ?, ?, '[]')`,
          args: [String(parsed.params.name), parsed.params.email || null, parsed.params.phone || null],
        })
        actionResult = toRow(await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
        actions.push({ type: 'contact_created', data: actionResult })
      }
      break
    }

    case 'contact_list': {
      actionResult = toRows(await db.execute('SELECT id, name, type, email FROM contacts ORDER BY name LIMIT 10'))
      actions.push({ type: 'contact_listed', data: actionResult })
      break
    }

    case 'finance_add_invoice': {
      const year = new Date().getFullYear()
      const countRow = toRow(await db.execute({ sql: `SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND strftime('%Y', created_at) = ?`, args: [String(year)] }))
      const count = (countRow?.c as number) ?? 0
      const invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`

      let contactId: number | null = null
      if (parsed.params.client) {
        const contact = toRow(await db.execute({ sql: 'SELECT id FROM contacts WHERE name LIKE ? LIMIT 1', args: [`%${parsed.params.client}%`] }))
        contactId = contact ? (contact.id as number) : null
      }

      const r = await db.execute({
        sql: `INSERT INTO finance_items (type, title, amount, contact_id, status, invoice_number, due_date, category) VALUES ('factuur', ?, ?, ?, 'concept', ?, ?, 'overig')`,
        args: [
          String(parsed.params.title || 'Nieuwe factuur'),
          (parsed.params.amount as number) || 0,
          contactId,
          invoiceNumber,
          parsed.params.due_date || null,
        ],
      })
      actionResult = toRow(await db.execute({ sql: 'SELECT * FROM finance_items WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
      actions.push({ type: 'finance_created', data: actionResult })
      break
    }

    case 'finance_add_expense': {
      const r = await db.execute({
        sql: `INSERT INTO finance_items (type, title, amount, status, category) VALUES ('uitgave', ?, ?, 'betaald', ?)`,
        args: [String(parsed.params.title || 'Uitgave'), (parsed.params.amount as number) || 0, String(parsed.params.category || 'overig')],
      })
      actionResult = toRow(await db.execute({ sql: 'SELECT * FROM finance_items WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
      actions.push({ type: 'finance_created', data: actionResult })
      break
    }

    case 'finance_list': {
      const row = toRow(await db.execute(`SELECT SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as amount, COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open FROM finance_items`))
      actionResult = row
      actions.push({ type: 'finance_listed', data: row })
      break
    }

    case 'habit_log': {
      const today = format(new Date(), 'yyyy-MM-dd')
      const habitName = String(parsed.params.habit_name || '')
      let habit: Record<string, unknown> | undefined

      if (habitName) {
        habit = toRow(await db.execute({ sql: 'SELECT * FROM habits WHERE name LIKE ? AND active = 1 LIMIT 1', args: [`%${habitName}%`] }))
      }
      if (!habit) {
        habit = toRow(await db.execute('SELECT * FROM habits WHERE active = 1 ORDER BY created_at LIMIT 1'))
      }

      if (habit) {
        await db.execute({ sql: 'INSERT OR REPLACE INTO habit_logs (habit_id, logged_date) VALUES (?, ?)', args: [habit.id as number, today] })
        actions.push({ type: 'habit_logged', data: { habit, date: today } })
      }
      break
    }

    case 'memory_add': {
      const fact = String(parsed.params.fact || '')
      if (fact) {
        const key = fact.slice(0, 60)
        await db.execute({ sql: 'INSERT OR REPLACE INTO memories (key, value, category) VALUES (?, ?, ?)', args: [key, fact, 'chat'] })
        actions.push({ type: 'memory_saved', data: { fact } })
      }
      break
    }

    case 'stats': {
      const todoRow = toRow(await db.execute('SELECT COUNT(*) as c FROM todos WHERE completed = 0'))
      const noteRow = toRow(await db.execute('SELECT COUNT(*) as c FROM notes'))
      const financeRow = toRow(await db.execute(`SELECT COUNT(*) as c, SUM(amount) as total FROM finance_items WHERE type='factuur' AND status IN ('verstuurd','verlopen')`))
      actionResult = {
        todoCount: (todoRow?.c as number) ?? 0,
        noteCount: (noteRow?.c as number) ?? 0,
        openInvoices: (financeRow?.c as number) ?? 0,
        openAmount: (financeRow?.total as number) ?? 0,
      }
      break
    }
  }

  const responseText = generateResponse(parsed, actionResult)

  let finalResponse = responseText
  if (parsed.intent === 'stats' && actionResult) {
    const r = actionResult as { todoCount: number; noteCount: number; openInvoices: number; openAmount: number }
    finalResponse += `\n\n• **${r.todoCount}** open todos\n• **${r.noteCount}** notes\n• **${r.openInvoices}** open facturen (€${r.openAmount.toFixed(2)})`
  }

  await db.execute({ sql: 'INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)', args: ['assistant', finalResponse, JSON.stringify(actions)] })

  return NextResponse.json({
    response: finalResponse,
    intent: parsed.intent,
    actions,
  })
}
