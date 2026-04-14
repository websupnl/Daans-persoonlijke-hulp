import type { SendTextMessageOptions, SendMessageResponse } from './types'

const GRAPH_API_VERSION = 'v21.0'

function getBaseUrl(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID is not set')
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`
}

function getToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  if (!token) throw new Error('WHATSAPP_ACCESS_TOKEN is not set')
  return token
}

/**
 * Send a plain text WhatsApp message to a phone number.
 * The `to` parameter should be in international format without + (e.g. "31612345678").
 */
export async function sendTextMessage(
  options: SendTextMessageOptions
): Promise<SendMessageResponse> {
  const { to, text, previewUrl = false } = options

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: previewUrl,
      body: text,
    },
  }

  const res = await fetch(getBaseUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`WhatsApp API error ${res.status}: ${error}`)
  }

  return res.json() as Promise<SendMessageResponse>
}

/**
 * Mark an incoming message as read.
 */
export async function markAsRead(messageId: string): Promise<void> {
  await fetch(getBaseUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(err => {
    // Non-fatal: log and continue
    console.warn('[WhatsApp] markAsRead failed:', err)
  })
}

/**
 * Safely send a reply. Returns false instead of throwing on failure.
 */
export async function trySendReply(to: string, text: string): Promise<boolean> {
  try {
    await sendTextMessage({ to, text })
    return true
  } catch (err) {
    console.error('[WhatsApp] Failed to send reply:', err)
    return false
  }
}
