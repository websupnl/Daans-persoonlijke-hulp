export const dynamic = 'force-dynamic'

/**
 * POST /api/telegram/setup
 *
 * Registers the webhook URL with Telegram. Call this once after deploying.
 * Secured with INTERNAL_API_KEY.
 *
 * Body: { "webhookUrl": "https://yourdomain.com/api/telegram/webhook" }
 * Or omit webhookUrl to auto-detect from request host.
 */

import { NextRequest, NextResponse } from 'next/server'
import { setWebhook, getWebhookInfo } from '@/lib/telegram/send-message'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let webhookUrl: string
  try {
    const body = await request.json() as { webhookUrl?: string }
    webhookUrl = body.webhookUrl ?? `https://${request.headers.get('host')}/api/telegram/webhook`
  } catch {
    webhookUrl = `https://${request.headers.get('host')}/api/telegram/webhook`
  }

  try {
    const result = await setWebhook(webhookUrl)
    return NextResponse.json({ success: result.ok, webhookUrl, telegram: result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Setup mislukt' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const info = await getWebhookInfo()
    return NextResponse.json(info)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ophalen mislukt' },
      { status: 500 }
    )
  }
}
