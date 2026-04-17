export const dynamic = 'force-dynamic'

/**
 * Deep Sync — Full System Audit
 *
 * Triggered manually (dashboard button or /sync Telegram command).
 * Runs a comprehensive "State of the Union" analysis
 * and sends a strategic report to Telegram.
 *
 * POST /api/telegram/deep-sync
 * Toegankelijk met een geldige sessie, INTERNAL_API_KEY of CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runDeepSync } from '@/lib/ai/proactive-engine'
import { getSessionFromRequest } from '@/lib/auth/request-session'
import { hasAllowedOrigin } from '@/lib/auth/session-store'
import { sendTelegramMessage } from '@/lib/telegram/send-message'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-api-key')
  const internalKey = process.env.INTERNAL_API_KEY
  const cronSecret = request.headers.get('authorization')
  const session = await getSessionFromRequest(request, { touch: true })

  if (session && !hasAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isAuthorized =
    !!session ||
    (internalKey && authHeader === internalKey) ||
    !!(process.env.CRON_SECRET && cronSecret === `Bearer ${process.env.CRON_SECRET}`)

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await runDeepSync()

    // Send to Telegram if configured
    const chatId = process.env.TELEGRAM_CHAT_ID
    let telegramSent = false

    if (chatId) {
      await sendTelegramMessage(parseInt(chatId, 10), report, {
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Ontvangen', callback_data: 'deep_sync_ack' },
            { text: '❓ Stel me een vraag', callback_data: 'generate_question' },
          ]],
        },
      })
      telegramSent = true
    }

    return NextResponse.json({
      ok: true,
      telegramSent,
      report,
    })
  } catch (err) {
    console.error('[DeepSync] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
