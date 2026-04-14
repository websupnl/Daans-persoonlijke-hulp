/**
 * Outbound WhatsApp notifications endpoint
 *
 * POST /api/notifications/send-whatsapp
 *
 * Beveiligd met INTERNAL_API_KEY.
 * Kan gebruikt worden voor reminders, dagoverzichten, weekoverzichten, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendTextMessage } from '@/lib/whatsapp/send-message'
import getDb from '@/lib/db'

interface SendRequest {
  to: string
  message: string
  type?: 'reminder' | 'daily_summary' | 'weekly_summary' | 'finance_alert' | 'custom'
}

export async function POST(request: NextRequest) {
  // Auth check
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

  const { to, message, type = 'custom' } = body
  if (!to || !message) {
    return NextResponse.json({ error: 'to en message zijn verplicht' }, { status: 400 })
  }

  try {
    const result = await sendTextMessage({ to, text: message })

    // Log de notificatie
    const db = getDb()
    db.prepare(`
      INSERT INTO conversation_log (user_message, assistant_message, parser_type, confidence, actions)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      `[outbound_notification:${type}] → ${to}`,
      message,
      'notification',
      1.0,
      JSON.stringify([{ type: 'whatsapp_sent', to, messageId: result.messages?.[0]?.id }])
    )

    return NextResponse.json({
      success: true,
      messageId: result.messages?.[0]?.id,
    })
  } catch (err) {
    console.error('[notifications/send-whatsapp] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Verzenden mislukt' },
      { status: 500 }
    )
  }
}
