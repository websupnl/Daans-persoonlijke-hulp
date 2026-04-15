export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/send-telegram
 *
 * Send a notification to Daan's Telegram.
 * Secured with INTERNAL_API_KEY.
 *
 * Required env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramMessage } from '@/lib/telegram/send-message'
import { execute } from '@/lib/db'

interface SendRequest {
  message: string
  type?: 'reminder' | 'daily_summary' | 'weekly_summary' | 'finance_alert' | 'custom'
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SendRequest
  try {
    body = await request.json() as SendRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { message, type = 'custom' } = body
  if (!message) {
    return NextResponse.json({ error: 'message is verplicht' }, { status: 400 })
  }

  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    return NextResponse.json({ error: 'TELEGRAM_CHAT_ID is not configured' }, { status: 500 })
  }

  try {
    await sendTelegramMessage(chatId, message)

    await execute(`
      INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      `[outbound_notification:${type}] → telegram:${chatId}`,
      message,
      'notification',
      1.0,
      JSON.stringify([{ type: 'telegram_sent', chatId }]),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notifications/send-telegram] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verzenden mislukt' },
      { status: 500 }
    )
  }
}
