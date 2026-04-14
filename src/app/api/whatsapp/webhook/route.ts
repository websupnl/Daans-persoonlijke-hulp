/**
 * WhatsApp Cloud API Webhook
 *
 * GET  — Meta webhook verificatie (hub.challenge response)
 * POST — Inkomende berichten en status updates van Meta
 *
 * Callback URL: https://daans-persoonlijke-hulp.vercel.app/api/whatsapp/webhook
 */

import { NextRequest, NextResponse } from 'next/server'
import { extractTextMessages, hasMessages } from '@/lib/whatsapp/parse-incoming'
import { ingestMessage } from '@/lib/whatsapp/ingest'
import { trySendReply, markAsRead } from '@/lib/whatsapp/send-message'
import type { WhatsAppWebhookPayload } from '@/lib/whatsapp/types'

// ─── GET: Meta webhook verification ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!verifyToken) {
    console.error('[WhatsApp webhook] WHATSAPP_VERIFY_TOKEN is not configured')
    return new NextResponse('Server misconfiguration', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp webhook] Verified successfully')
    // Meta verwacht exact de challenge string terug als plain text
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.warn('[WhatsApp webhook] Verification failed', { mode, tokenMatch: token === verifyToken })
  return new NextResponse('Forbidden', { status: 403 })
}

// ─── POST: Inkomende berichten ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let rawBody: string

  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Cannot read body' }, { status: 400 })
  }

  // Meta verwacht altijd 200 terug — anders herprobeert het oneindig
  // Verwerk asynchroon, stuur meteen 200 terug
  processWebhook(rawBody).catch(err => {
    console.error('[WhatsApp webhook] Background processing error:', err)
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

// ─── Interne verwerking (async, non-blocking) ───────────────────────────────────

async function processWebhook(rawBody: string): Promise<void> {
  let payload: WhatsAppWebhookPayload

  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload
  } catch {
    console.error('[WhatsApp webhook] Invalid JSON payload')
    return
  }

  // Alleen WhatsApp events verwerken
  if (payload.object !== 'whatsapp_business_account') {
    console.log('[WhatsApp webhook] Ignoring non-WhatsApp event:', payload.object)
    return
  }

  // Geen berichten (bijv. alleen status updates) — negeer stilletjes
  if (!hasMessages(payload)) {
    console.log('[WhatsApp webhook] No text messages in payload (possibly status update)')
    return
  }

  const messages = extractTextMessages(payload)
  console.log(`[WhatsApp webhook] Processing ${messages.length} message(s)`)

  for (const msg of messages) {
    try {
      console.log(`[WhatsApp webhook] Message from ${msg.senderName} (${msg.from}): "${msg.text}"`)

      // Markeer als gelezen (non-fatal)
      await markAsRead(msg.messageId)

      // Verwerk via interne engine (hergebruikt AI/rule-based logica)
      const result = await ingestMessage({
        message: msg.text,
        source: 'whatsapp',
        senderPhone: msg.from,
        senderName: msg.senderName,
      })

      console.log(`[WhatsApp webhook] Reply (${result.parserType}, conf=${result.confidence.toFixed(2)}): "${result.reply}"`)

      // Stuur reply terug via WhatsApp
      if (result.reply) {
        await trySendReply(msg.from, result.reply)
      }
    } catch (err) {
      console.error(`[WhatsApp webhook] Error processing message ${msg.messageId}:`, err)
      // Probeer fout-reply te sturen
      await trySendReply(
        msg.from,
        'Er ging iets mis bij het verwerken van je bericht. Probeer het opnieuw.'
      ).catch(() => {})
    }
  }
}
