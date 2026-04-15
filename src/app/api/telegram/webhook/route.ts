export const dynamic = 'force-dynamic'

/**
 * Telegram Bot Webhook
 *
 * POST — receives updates from Telegram, replies to Daan's messages.
 *
 * Setup: POST /api/telegram/setup  (once, with your deployed URL)
 * Or set manually: https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://yourdomain.com/api/telegram/webhook
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather
 *   TELEGRAM_CHAT_ID     — Daan's personal chat ID (optional: restricts to one user)
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/send-message'
import { ingestMessage } from '@/lib/telegram/ingest'
import type { TelegramUpdate } from '@/lib/telegram/send-message'

export async function POST(request: NextRequest) {
  // Parse the update
  let update: TelegramUpdate
  try {
    update = await request.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Process synchronously — Vercel kills the lambda after response, so await first
  try {
    await handleUpdate(update)
  } catch (err) {
    console.error('[Telegram webhook] Processing error:', err)
  }

  return NextResponse.json({ ok: true })
}

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message
  if (!message?.text) {
    // Ignore non-text messages (photos, stickers, etc.)
    return
  }

  const chatId = message.chat.id
  const text = message.text
  const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ')

  // Optional: restrict to Daan's chat only
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
      await sendTelegramMessage(chatId, result.reply)
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
