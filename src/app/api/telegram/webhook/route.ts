export const dynamic = 'force-dynamic'

/**
 * Telegram Bot Webhook
 *
 * POST — receives updates from Telegram, replies to Daan's messages.
 *
 * Handles:
 *   - message: standard text messages routed through the ingest pipeline.
 *   - callback_query: inline button presses for quick actions (complete todo,
 *     pin note, show worklog status).
 *
 * Setup: POST /api/telegram/setup  (once, with your deployed URL)
 * Or set manually: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://yourdomain.com/api/telegram/webhook
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   TELEGRAM_CHAT_ID     — Daan's personal chat ID (optional: restricts to one user)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage, answerCallbackQuery } from '@/lib/telegram/send-message'
import { ingestMessage } from '@/lib/telegram/ingest'
import { queryOne, execute } from '@/lib/db'
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
  const text = message.text
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ')

  const allowedChatId = process.env.TELEGRAM_CHAT_ID
  if (allowedChatId && String(chatId) !== allowedChatId) {
    console.warn(`[Telegram webhook] Ignoring message from unknown chat: ${chatId}`)
    await sendTelegramMessage(chatId, '⛔ Je bent niet geautoriseerd om deze bot te gebruiken.')
    return
  }

  console.log(`[Telegram webhook] Message from ${senderName} (${chatId}): "${text}"`)
  console.log(`[Telegram webhook] BOT_TOKEN set: ${!!process.env.TELEGRAM_BOT_TOKEN}, CHAT_ID: ${process.env.TELEGRAM_CHAT_ID}`)

  try {
    const result = await ingestMessage({
      message: text,
      source: 'telegram',
      senderName: senderName || undefined,
    })

    console.log(`[Telegram webhook] Reply (${result.parserType}, conf=${result.confidence.toFixed(2)}): "${result.reply?.slice(0, 80)}"`)

    if (result.reply) {
      await sendTelegramMessage(chatId, result.reply, {
        reply_markup: result.replyMarkup,
      })
      console.log('[Telegram webhook] Message sent successfully')
    }
  } catch (err) {
    console.error('[Telegram webhook] Error:', err instanceof Error ? err.message : err)
    try {
      await sendTelegramMessage(chatId, '❌ Er ging iets mis. Probeer het opnieuw.')
    } catch (sendErr) {
      console.error('[Telegram webhook] Also failed to send error message:', sendErr instanceof Error ? sendErr.message : sendErr)
    }
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

  console.log(`[Telegram webhook] Callback query: "${callbackData}"`)

  try {
    const [action, idStr] = callbackData.split(':')
    const id = parseInt(idStr, 10)

    if (action === 'todo_complete' && !isNaN(id)) {
      const todo = await queryOne<{ id: number; title: string }>(
        'SELECT id, title FROM todos WHERE id = $1 AND completed = 0 LIMIT 1',
        [id]
      )

      if (!todo) {
        await answerCallbackQuery(cb.id, '✅ Al afgerond of niet gevonden')
        return
      }

      await execute('UPDATE todos SET completed = 1, completed_at = NOW(), updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `✅ Klaar: ${todo.title}`)

      if (chatId) {
        await sendTelegramMessage(chatId, `✅ Taak afgerond: *${todo.title}* \`[ID: ${id}]\``)
      }
      return
    }

    if (action === 'note_pin' && !isNaN(id)) {
      const note = await queryOne<{ id: number; title: string }>(
        'SELECT id, title FROM notes WHERE id = $1 LIMIT 1',
        [id]
      )

      if (!note) {
        await answerCallbackQuery(cb.id, '📌 Notitie niet gevonden')
        return
      }

      await execute('UPDATE notes SET pinned = 1, updated_at = NOW() WHERE id = $1', [id])
      await answerCallbackQuery(cb.id, `📌 Vastgepind: ${note.title}`)

      if (chatId) {
        await sendTelegramMessage(chatId, `📌 Notitie vastgepind: *${note.title}* \`[ID: ${id}]\``)
      }
      return
    }

    if (action === 'worklog_status' && !isNaN(id)) {
      const log = await queryOne<{ id: number; title: string; duration_minutes: number; context: string; date: string }>(
        `SELECT id, title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes,
                context, TO_CHAR(date, 'YYYY-MM-DD') as date
         FROM work_logs WHERE id = $1 LIMIT 1`,
        [id]
      )

      if (!log) {
        await answerCallbackQuery(cb.id, '📊 Werklog niet gevonden')
        return
      }

      const h = Math.floor(log.duration_minutes / 60)
      const m = log.duration_minutes % 60
      const durationStr = `${h > 0 ? h + 'u ' : ''}${m > 0 ? m + 'm' : ''}`.trim()

      await answerCallbackQuery(cb.id, `${log.title} — ${durationStr}`)

      if (chatId) {
        await sendTelegramMessage(
          chatId,
          `📊 *Werklog* \`[ID: ${id}]\`\n- Titel: ${log.title}\n- Duur: ${durationStr}\n- Context: ${log.context}\n- Datum: ${log.date}`
        )
      }
      return
    }

    await answerCallbackQuery(cb.id, 'Onbekende actie')
  } catch (err) {
    console.error('[Telegram webhook] Callback error:', err instanceof Error ? err.message : err)
    await answerCallbackQuery(cb.id, '❌ Er ging iets mis')
  }
}
