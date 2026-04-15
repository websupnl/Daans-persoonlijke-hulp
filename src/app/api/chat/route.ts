export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'
import { parseIntent, COMMAND_INTENTS } from '@/lib/chat-parser'
import { getUserContext, contextToPrompt } from '@/lib/context-builder'
import { format } from 'date-fns'

// ── AI client ─────────────────────────────────────────────────────────────────

function buildSystemPrompt(contextStr: string): string {
  return `Je bent een slimme persoonlijke AI-assistent voor Daan. Je kent zijn leven door zijn actuele data en helpt hem elke dag productiever en bewuster te zijn.

=== DAAN'S ACTUELE CONTEXT ===
${contextStr}
=== EINDE CONTEXT ===

Instructies:
- Antwoord ALTIJD in het Nederlands, direct en persoonlijk
- Gebruik de context actief: noem specifieke todos, gewoontes, bedragen, streaks
- Bij actiebevestigingen: kort en krachtig, voeg een relevante observatie toe op basis van zijn data
- Bij vragen/analyse: geef concrete antwoorden met zijn echte cijfers
- Wijs proactief op urgente zaken (verlopen facturen, te late todos, ongedane gewoontes)
- Gebruik **bold** en bullet points voor leesbaarheid
- Maximaal 250 woorden tenzij de vraag écht meer vraagt
- Spreek Daan altijd direct aan`
}

async function callAI(userMessage: string, systemPrompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    return callAnthropic(userMessage, systemPrompt)
  }
  if (process.env.OPENAI_API_KEY) {
    return callOpenAI(userMessage, systemPrompt)
  }
  throw new Error('no_key')
}

async function callAnthropic(message: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: message }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic: ${await res.text()}`)
  const data = await res.json()
  return data.content[0].text as string
}

async function callOpenAI(message: string, system: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
      max_tokens: 600,
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI: ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content as string
}

// ── GET: chatgeschiedenis ─────────────────────────────────────────────────────

export async function GET() {
  const db = await getDb()
  const result = await db.execute('SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 60')
  const messages = toRows(result).reverse()
  return NextResponse.json({
    data: messages.map(m => ({ ...m, actions: JSON.parse(m.actions as string || '[]') })),
    ai_provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : process.env.OPENAI_API_KEY ? 'openai' : null,
  })
}

// ── POST: verwerk bericht ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { message } = body

  if (!message?.trim()) return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })

  // Sla gebruikersbericht op
  await db.execute({
    sql: 'INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)',
    args: ['user', message, '[]'],
  })

  // ── Voer actie uit als het een command-intent is ──────────────────────────
  const parsed = parseIntent(message)
  const isCommand = COMMAND_INTENTS.includes(parsed.intent)
  const actions: unknown[] = []
  let actionContext = ''

  if (isCommand) {
    switch (parsed.intent) {
      case 'todo_add': {
        if (parsed.params.title) {
          const r = await db.execute({
            sql: 'INSERT INTO todos (title, category, priority, due_date) VALUES (?, ?, ?, ?)',
            args: [String(parsed.params.title), parsed.params.category || 'overig', parsed.params.priority || 'medium', parsed.params.due_date || null],
          })
          const todo = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
          actions.push({ type: 'todo_created', data: todo })
          actionContext = `Todo aangemaakt: "${parsed.params.title}", prioriteit: ${parsed.params.priority || 'medium'}${parsed.params.due_date ? `, deadline: ${parsed.params.due_date}` : ''}.`
        }
        break
      }

      case 'todo_complete': {
        const q = String(parsed.params.query || '')
        if (q) {
          const todo = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE completed = 0 AND title LIKE ? LIMIT 1', args: [`%${q}%`] }))
          if (todo) {
            await db.execute({ sql: "UPDATE todos SET completed = 1, completed_at = datetime('now') WHERE id = ?", args: [todo.id as number] })
            actions.push({ type: 'todo_completed', data: todo })
            actionContext = `Todo afgevinkt: "${todo.title}".`
          } else {
            actionContext = `Geen open todo gevonden met "${q}".`
          }
        }
        break
      }

      case 'todo_delete': {
        const q = String(parsed.params.query || '')
        if (q) {
          const todo = toRow(await db.execute({ sql: 'SELECT * FROM todos WHERE title LIKE ? LIMIT 1', args: [`%${q}%`] }))
          if (todo) {
            await db.execute({ sql: 'DELETE FROM todos WHERE id = ?', args: [todo.id as number] })
            actionContext = `Todo verwijderd: "${todo.title}".`
          }
        }
        break
      }

      case 'note_add': {
        const content = String(parsed.params.content || '')
        if (content) {
          const r = await db.execute({
            sql: 'INSERT INTO notes (title, content, content_text) VALUES (?, ?, ?)',
            args: [content.slice(0, 60), content, content],
          })
          const note = toRow(await db.execute({ sql: 'SELECT * FROM notes WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
          actions.push({ type: 'note_created', data: note })
          actionContext = `Note opgeslagen: "${content.slice(0, 80)}".`
        }
        break
      }

      case 'contact_add': {
        if (parsed.params.name) {
          const r = await db.execute({
            sql: "INSERT INTO contacts (name, email, phone, tags) VALUES (?, ?, ?, '[]')",
            args: [String(parsed.params.name), parsed.params.email || null, parsed.params.phone || null],
          })
          const contact = toRow(await db.execute({ sql: 'SELECT * FROM contacts WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
          actions.push({ type: 'contact_created', data: contact })
          actionContext = `Contact toegevoegd: "${parsed.params.name}".`
        }
        break
      }

      case 'finance_add_invoice': {
        const year = new Date().getFullYear()
        const countRow = toRow(await db.execute({ sql: "SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND strftime('%Y', created_at) = ?", args: [String(year)] }))
        const count = (countRow?.c as number) ?? 0
        const invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`
        let contactId: number | null = null
        if (parsed.params.client) {
          const c = toRow(await db.execute({ sql: 'SELECT id FROM contacts WHERE name LIKE ? LIMIT 1', args: [`%${parsed.params.client}%`] }))
          contactId = c ? (c.id as number) : null
        }
        const r = await db.execute({
          sql: "INSERT INTO finance_items (type, title, amount, contact_id, status, invoice_number, due_date, category) VALUES ('factuur', ?, ?, ?, 'concept', ?, ?, 'overig')",
          args: [String(parsed.params.title || 'Nieuwe factuur'), (parsed.params.amount as number) || 0, contactId, invoiceNumber, parsed.params.due_date || null],
        })
        const item = toRow(await db.execute({ sql: 'SELECT * FROM finance_items WHERE id = ?', args: [Number(r.lastInsertRowid)] }))
        actions.push({ type: 'finance_created', data: item })
        actionContext = `Factuur ${invoiceNumber} aangemaakt${parsed.params.client ? ` voor ${parsed.params.client}` : ''}${parsed.params.amount ? `, bedrag €${parsed.params.amount}` : ''}.`
        break
      }

      case 'finance_add_expense': {
        const r = await db.execute({
          sql: "INSERT INTO finance_items (type, title, amount, status, category) VALUES ('uitgave', ?, ?, 'betaald', ?)",
          args: [String(parsed.params.title || 'Uitgave'), (parsed.params.amount as number) || 0, String(parsed.params.category || 'overig')],
        })
        actions.push({ type: 'finance_created', data: toRow(await db.execute({ sql: 'SELECT * FROM finance_items WHERE id = ?', args: [Number(r.lastInsertRowid)] })) })
        actionContext = `Uitgave gelogd: €${parsed.params.amount || 0} voor "${parsed.params.title}".`
        break
      }

      case 'finance_add_income': {
        const r = await db.execute({
          sql: "INSERT INTO finance_items (type, title, amount, status, category) VALUES ('inkomst', ?, ?, 'betaald', 'overig')",
          args: [String(parsed.params.title || 'Inkomst'), (parsed.params.amount as number) || 0],
        })
        actions.push({ type: 'finance_created', data: toRow(await db.execute({ sql: 'SELECT * FROM finance_items WHERE id = ?', args: [Number(r.lastInsertRowid)] })) })
        actionContext = `Inkomst van €${parsed.params.amount || 0} geregistreerd.`
        break
      }

      case 'habit_log': {
        const today = format(new Date(), 'yyyy-MM-dd')
        const habitName = String(parsed.params.habit_name || '')
        const habit = habitName
          ? toRow(await db.execute({ sql: 'SELECT * FROM habits WHERE name LIKE ? AND active = 1 LIMIT 1', args: [`%${habitName}%`] }))
          : toRow(await db.execute('SELECT * FROM habits WHERE active = 1 ORDER BY created_at LIMIT 1'))
        if (habit) {
          await db.execute({ sql: 'INSERT OR REPLACE INTO habit_logs (habit_id, logged_date) VALUES (?, ?)', args: [habit.id as number, today] })
          actions.push({ type: 'habit_logged', data: { habit, date: today } })
          actionContext = `Gewoonte "${habit.name}" gelogd voor vandaag.`
        }
        break
      }

      case 'memory_add': {
        const fact = String(parsed.params.fact || '')
        if (fact) {
          await db.execute({ sql: 'INSERT OR REPLACE INTO memories (key, value, category) VALUES (?, ?, ?)', args: [fact.slice(0, 60), fact, 'chat'] })
          actions.push({ type: 'memory_saved', data: { fact } })
          actionContext = `Onthouden: "${fact}".`
        }
        break
      }
    }
  }

  // ── Bouw context en stuur naar AI ─────────────────────────────────────────
  const userCtx = await getUserContext(db)
  const contextStr = contextToPrompt(userCtx)
  const systemPrompt = buildSystemPrompt(contextStr)

  // Voeg actie-info toe aan de AI prompt zodat die er natuurlijk op kan reageren
  const aiUserMessage = actionContext
    ? `${message}\n\n[Systeem: ${actionContext}]`
    : message

  let response: string
  try {
    response = await callAI(aiUserMessage, systemPrompt)
  } catch (err) {
    if (err instanceof Error && err.message === 'no_key') {
      response = `⚠️ **Geen AI API key geconfigureerd.**\n\nVoeg een van de volgende toe aan je \`.env.local\`:\n\`\`\`\nANTHROPIC_API_KEY=sk-ant-...\n# of\nOPENAI_API_KEY=sk-...\n\`\`\`\n\nHerstart daarna de server.`
    } else {
      response = `⚠️ AI tijdelijk niet beschikbaar: ${err instanceof Error ? err.message : 'onbekende fout'}. Probeer het opnieuw.`
    }
  }

  // Sla antwoord op
  await db.execute({
    sql: 'INSERT INTO chat_messages (role, content, actions) VALUES (?, ?, ?)',
    args: ['assistant', response, JSON.stringify(actions)],
  })

  return NextResponse.json({
    response,
    intent: parsed.intent,
    actions,
    ai_powered: true,
    provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
  })
}
