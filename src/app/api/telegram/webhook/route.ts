export const dynamic = 'force-dynamic'

/**
 * Telegram Bot Webhook — Daan 2.0
 *
 * Handles:
 *   - Standard messages → ingest pipeline
 *   - /vraag → Deep-dive reflectievraag
 *   - /sync → Full deep sync rapport
 *   - /status → Life snapshot samenvatting
 *   - Callback queries → todo complete, note pin, nudge resolve/snooze, diary follow-up
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, answerCallbackQuery } from '@/lib/telegram/send-message'
import { ingestMessage } from '@/lib/telegram/ingest'
import { queryOne, execute, query } from '@/lib/db'
import { generateDeepQuestion, runDeepSync } from '@/lib/ai/proactive-engine'
import { analyzeDiaryEntry, formatDiaryAnalysisForTelegram } from '@/lib/ai/diary-personas'
import { buildLifeSnapshot, formatSnapshotForPrompt } from '@/lib/ai/life-snapshot'
import type { TelegramUpdate } from '@/lib/telegram/send-message'

export async function POST(request: NextRequest) {
  let update: TelegramUpdate
  try {
    update = await request.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update)
    } else {
      await handleUpdate(update)
    }
  } catch (err) {
    console.error('[Telegram webhook] Processing error:', err)
  }

  return NextResponse.json({ ok: true })
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message
  if (!message?.text) return

  const chatId = message.chat.id
  const text = message.text.trim()
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ')

  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (allowedChatId && String(chatId) !== allowedChatId) {
    await sendTelegramMessage(chatId, '⛔ Je bent niet geautoriseerd om deze bot te gebruiken.')
    return
  }

  // ── Slash Commands ─────────────────────────────────────────────────────────

  if (text === '/vraag' || text.toLowerCase() === '/stelmeenvraag') {
    await sendTelegramMessage(chatId, '🧠 _Bezig met een diepgravende vraag voor je..._')
    try {
      const question = await generateDeepQuestion()
      await sendTelegramMessage(chatId, `💬 *Reflectievraag*\n\n${question}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📔 Beantwoord in dagboek', callback_data: 'journal_start' },
            { text: '💬 Stuur antwoord hier', callback_data: 'reply_here' },
          ]],
        },
      })
    } catch (err) {
      await sendTelegramMessage(chatId, '❌ Kon geen vraag genereren. Probeer het opnieuw.')
      console.error('[Webhook] /vraag error:', err)
    }
    return
  }

  if (text === '/sync' || text === '/deepSync' || text.toLowerCase() === '/rapport') {
    await sendTelegramMessage(chatId, '🧠 _Volledige systeemscan wordt uitgevoerd..._')
    try {
      const report = await runDeepSync()
      await sendTelegramMessage(chatId, report, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Ontvangen', callback_data: 'deep_sync_ack' },
            { text: '❓ Stel me een vraag', callback_data: 'generate_question' },
          ]],
        },
      })
    } catch (err) {
      await sendTelegramMessage(chatId, '❌ Deep sync mislukt. Probeer het opnieuw.')
      console.error('[Webhook] /sync error:', err)
    }
    return
  }

  if (text === '/status' || text === '/snap') {
    try {
      const snap = await buildLifeSnapshot()
      const formatted = formatSnapshotForPrompt(snap)
      await sendTelegramMessage(chatId, `📊 *Life Snapshot*\n\n\`\`\`\n${formatted}\n\`\`\``)
    } catch (err) {
      await sendTelegramMessage(chatId, '❌ Snapshot ophalen mislukt.')
      console.error('[Webhook] /status error:', err)
    }
    return
  }

  if (text === '/help' || text === '/start') {
    await sendTelegramMessage(chatId,
      `🧠 *Daan's Personal Brain*\n\n` +
      `*Commando's:*\n` +
      `• /vraag — Diepgravende reflectievraag\n` +
      `• /sync — Volledig leven-rapport\n` +
      `• /status — Huidige life snapshot\n\n` +
      `*Of typ gewoon:*\n` +
      `• "Taak toevoegen: X"\n` +
      `• "Noteer €50 uitgave aan boodschappen"\n` +
      `• "Ik heb 2u gewerkt aan WebsUp"\n` +
      `• "Hoe staat mijn dagboek ervoor?"\n\n` +
      `_Je persoonlijke AI is altijd actief en denkt met je mee._`
    )
    return
  }

  // ── Check if there's a pending diary follow-up for this user ──────────────
  const pendingJournalConvo = await queryOne<{
    session_id: string
    pending_question: string
    state: string
  }>(
    `SELECT session_id, pending_question, state
     FROM journal_conversation
     WHERE session_id = $1 AND state = 'waiting_followup'`,
    [String(chatId)]
  )

  if (pendingJournalConvo?.pending_question) {
    // This message is the answer to the pending follow-up
    // Save it as additional journal content and analyze further
    await execute(
      `UPDATE journal_conversation SET state = 'complete', updated_at = NOW() WHERE session_id = $1`,
      [String(chatId)]
    )

    const analysis = await analyzeDiaryEntry(text, null, null)
    const telegramResponse = formatDiaryAnalysisForTelegram(analysis)

    await sendTelegramMessage(
      chatId,
      `✍️ _Ik heb je antwoord gelezen._\n\n${telegramResponse}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '📔 In dagboek opslaan', callback_data: `save_journal_note:${encodeURIComponent(text.slice(0, 100))}` },
            { text: '💬 Vraag meer', callback_data: 'generate_question' },
          ]],
        },
      }
    )
    return
  }

  // ── Standard message through ingest pipeline ──────────────────────────────
  console.log(`[Telegram webhook] Message from ${senderName} (${chatId}): "${text}"`)

  try {
    const result = await ingestMessage({
      message: text,
      source: 'telegram',
      senderName: senderName || undefined,
    })

    if (result.reply) {
      // If this was a journal-related message, add diary analysis
      const isJournalAction = (result.actions as Array<{ type?: string }>)?.some(
        (a) => a?.type === 'journal_create'
      )

      if (isJournalAction && result.reply) {
        await sendTelegramMessage(chatId, result.reply, { reply_markup: result.replyMarkup })

        // Asynchronously generate diary follow-up
        setTimeout(async () => {
          try {
            const todayJournal = await queryOne<{ content: string; mood: number; energy: number }>(
              'SELECT content, mood, energy FROM journal_entries WHERE date = CURRENT_DATE LIMIT 1'
            )
            if (todayJournal) {
              const analysis = await analyzeDiaryEntry(
                todayJournal.content,
                todayJournal.mood,
                todayJournal.energy
              )
              const followUp = formatDiaryAnalysisForTelegram(analysis)

              // Store follow-up state
              await execute(`
                INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
                VALUES ($1, 'waiting_followup', $2, '{}')
                ON CONFLICT(session_id) DO UPDATE
                  SET state = 'waiting_followup', pending_question = EXCLUDED.pending_question, updated_at = NOW()
              `, [String(chatId), analysis.followUpQuestion])

              await sendTelegramMessage(chatId, `📔 _Je entry is opgeslagen._\n\n${followUp}`)
            }
          } catch (err) {
            console.error('[Webhook] Diary follow-up error:', err instanceof Error ? err.message : err)
          }
        }, 2000)
      } else {
        await sendTelegramMessage(chatId, result.reply, { reply_markup: result.replyMarkup })
      }
    }
  } catch (err) {
    console.error('[Telegram webhook] Error:', err instanceof Error ? err.message : err)
    try {
      await sendTelegramMessage(chatId, '❌ Er ging iets mis. Probeer het opnieuw.')
    } catch { /* ignore */ }
  }
}

async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const cb = update.callback_query
  if (!cb) return

  const chatId = cb.message?.chat.id
  const callbackData = cb.data ?? ''

  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (allowedChatId && chatId && String(chatId) !== allowedChatId) {
    await answerCallbackQuery(cb.id, '⛔ Niet geautoriseerd')
    return
  }

  try {
    const colonIdx = callbackData.indexOf(':')
    const action = colonIdx >= 0 ? callbackData.slice(0, colonIdx) : callbackData
    const rest = colonIdx >= 0 ? callbackData.slice(colonIdx + 1) : ''

    // ── Todo complete ─────────────────────────────────────────────────────
    if (action === 'todo_complete') {
      const id = parseInt(rest, 10)
      if (isNaN(id)) { await answerCallbackQuery(cb.id, 'Ongeldig ID'); return }

      const todo = await queryOne<{ id: number; title: string }>(
        'SELECT id, title FROM todos WHERE id = $1 AND completed = 0 LIMIT 1', [id]
      )
      if (!todo) { await answerCallbackQuery(cb.id, '✅ Al afgerond of niet gevonden'); return }

      await execute('UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `✅ Klaar: ${todo.title}`)
      if (chatId) await sendTelegramMessage(chatId, `✅ Taak afgerond: *${todo.title}* \`[ID: ${id}]\``)
      return
    }

    // ── Note pin ──────────────────────────────────────────────────────────
    if (action === 'note_pin') {
      const id = parseInt(rest, 10)
      const note = await queryOne<{ id: number; title: string }>(
        'SELECT id, title FROM notes WHERE id = $1 LIMIT 1', [id]
      )
      if (!note) { await answerCallbackQuery(cb.id, '📌 Notitie niet gevonden'); return }
      await execute('UPDATE notes SET pinned = 1, updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `📌 Vastgepind: ${note.title}`)
      if (chatId) await sendTelegramMessage(chatId, `📌 Notitie vastgepind: *${note.title}* \`[ID: ${id}]\``)
      return
    }

    // ── Worklog status ────────────────────────────────────────────────────
    if (action === 'worklog_status') {
      const id = parseInt(rest, 10)
      const log = await queryOne<{ id: number; title: string; duration_minutes: number; context: string; date: string }>(
        `SELECT id, title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes,
                context, TO_CHAR(date, 'YYYY-MM-DD') as date
         FROM work_logs WHERE id = $1 LIMIT 1`, [id]
      )
      if (!log) { await answerCallbackQuery(cb.id, '📊 Werklog niet gevonden'); return }
      const h = Math.floor(log.duration_minutes / 60)
      const m = log.duration_minutes % 60
      const dur = `${h > 0 ? h + 'u ' : ''}${m > 0 ? m + 'm' : ''}`.trim()
      await answerCallbackQuery(cb.id, `${log.title} — ${dur}`)
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `📊 *Werklog* \`[ID: ${id}]\`\n- Titel: ${log.title}\n- Duur: ${dur}\n- Context: ${log.context}\n- Datum: ${log.date}`
        )
      }
      return
    }

    // ── Nudge resolve ─────────────────────────────────────────────────────
    if (action === 'nudge_resolve') {
      const topic = rest
      await execute(
        `UPDATE nudge_state SET resolved_at = NOW() WHERE topic = $1`,
        [topic]
      )
      await answerCallbackQuery(cb.id, '✅ Begrepen, ik laat dit topic los')
      return
    }

    // ── Nudge snooze ──────────────────────────────────────────────────────
    if (action === 'nudge_snooze') {
      const [topic, hoursStr] = rest.split(':')
      const hours = parseInt(hoursStr ?? '4', 10)
      await execute(
        `UPDATE nudge_state SET last_nudged_at = NOW() - INTERVAL '1 hour' * ($1 - $2) WHERE topic = $3`,
        [
          NUDGE_COOLDOWN_HOURS_MAP[topic] ?? 24,
          hours,
          topic,
        ]
      )
      await answerCallbackQuery(cb.id, `⏰ Herinner ik je over ${hours}u`)
      return
    }

    // ── Journal start ─────────────────────────────────────────────────────
    if (action === 'journal_start') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `📔 *Dagboek sessie*\n\nTyp je reflectie hier. Je kunt schrijven over hoe je dag was, wat je bezighoudt, of gewoon alles wat in je opkomt.\n\n_Ik luister en reageer daarna._`
        )
        await execute(`
          INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
          VALUES ($1, 'waiting_entry', NULL, '{}')
          ON CONFLICT(session_id) DO UPDATE
            SET state = 'waiting_entry', pending_question = NULL, updated_at = NOW()
        `, [String(chatId)])
      }
      return
    }

    // ── Generate question ─────────────────────────────────────────────────
    if (action === 'generate_question') {
      await answerCallbackQuery(cb.id, '🧠 Vraag genereren...')
      if (chatId) {
        const question = await generateDeepQuestion()
        await sendTelegramMessage(chatId, `💬 *Reflectievraag*\n\n${question}`, {
          reply_markup: {
            inline_keyboard: [[
              { text: '📔 Beantwoord in dagboek', callback_data: 'journal_start' },
            ]],
          },
        })
      }
      return
    }

    // ── Deep sync ack ─────────────────────────────────────────────────────
    if (action === 'deep_sync_ack') {
      await answerCallbackQuery(cb.id, '✅ Rapport ontvangen')
      return
    }

    // ── Finance overview ──────────────────────────────────────────────────
    if (action === 'finance_overview') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        const items = await query<{ type: string; title: string; amount: number; status: string }>(`
          SELECT type, title, amount, status
          FROM finance_items
          WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
          ORDER BY created_at DESC LIMIT 10
        `)
        const lines = items.map(i => `- ${i.type}: *${i.title}* €${Number(i.amount).toFixed(2)} (${i.status})`)
        await sendTelegramMessage(
          chatId,
          `💰 *Financiën deze maand*\n\n${lines.join('\n') || '_Geen items gevonden_'}`
        )
      }
      return
    }

    // ── Todos overview ────────────────────────────────────────────────────
    if (action === 'todos_overview') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        const todos = await query<{ id: number; title: string; priority: string; due_date: string | null }>(`
          SELECT id, title, priority, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date
          FROM todos WHERE completed = 0
          ORDER BY CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 10
        `)
        const lines = todos.map(t => {
          const due = t.due_date ? ` _(${t.due_date})_` : ''
          return `- [${t.priority}] ${t.title}${due} \`[ID:${t.id}]\``
        })
        await sendTelegramMessage(
          chatId,
          `📋 *Open taken*\n\n${lines.join('\n') || '_Geen open taken_'}`
        )
      }
      return
    }

    // ── Reply here (answer question in chat) ──────────────────────────────
    if (action === 'reply_here') {
      await answerCallbackQuery(cb.id, '')
      if (chatId) {
        await sendTelegramMessage(chatId, '_Typ je antwoord gewoon hieronder. Ik bewaar het voor je._')
        await execute(`
          INSERT INTO journal_conversation (session_id, state, pending_question, context_snapshot)
          VALUES ($1, 'waiting_followup', 'open_question', '{}')
          ON CONFLICT(session_id) DO UPDATE
            SET state = 'waiting_followup', updated_at = NOW()
        `, [String(chatId)])
      }
      return
    }

    await answerCallbackQuery(cb.id, 'Onbekende actie')
  } catch (err) {
    console.error('[Telegram webhook] Callback error:', err instanceof Error ? err.message : err)
    await answerCallbackQuery(cb.id, '❌ Er ging iets mis')
  }
}

// Map for nudge snooze cooldown lookup
const NUDGE_COOLDOWN_HOURS_MAP: Record<string, number> = {
  finance_silence: 48,
  open_invoices: 72,
  journal_silence: 36,
  overdue_todos: 24,
  stale_todos: 72,
  habit_streak: 24,
  inbox_overflow: 12,
  user_silence: 24,
  mood_decline: 48,
  workload_today: 12,
}
