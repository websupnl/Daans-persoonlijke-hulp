import type {
  WhatsAppWebhookPayload,
  WhatsAppMessage,
  WhatsAppContact,
  NormalizedWhatsAppMessage,
} from './types'

/**
 * Extract all text messages from a Meta webhook payload.
 * Returns an empty array if there are no text messages (e.g. status updates only).
 */
export function extractTextMessages(
  payload: WhatsAppWebhookPayload
): NormalizedWhatsAppMessage[] {
  const results: NormalizedWhatsAppMessage[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const { messages, contacts, metadata } = change.value
      if (!messages?.length) continue

      for (const msg of messages) {
        const text = getMessageText(msg)
        if (!text) continue

        const contact = contacts?.find((c: WhatsAppContact) => c.wa_id === msg.from)

        results.push({
          messageId: msg.id,
          from: msg.from,
          senderName: contact?.profile?.name ?? msg.from,
          text: text.trim(),
          timestamp: new Date(parseInt(msg.timestamp) * 1000),
          phoneNumberId: metadata.phone_number_id,
          raw: msg,
        })
      }
    }
  }

  return results
}

/**
 * Extract plain text from any supported message type.
 */
function getMessageText(msg: WhatsAppMessage): string | null {
  switch (msg.type) {
    case 'text':
      return msg.text?.body ?? null
    case 'button':
      return msg.button?.text ?? null
    case 'interactive':
      return (
        msg.interactive?.button_reply?.title ??
        msg.interactive?.list_reply?.title ??
        null
      )
    default:
      return null
  }
}

/**
 * Check if a payload contains any actual messages (not just status updates).
 */
export function hasMessages(payload: WhatsAppWebhookPayload): boolean {
  return payload.entry?.some(entry =>
    entry.changes?.some(c => c.field === 'messages' && (c.value.messages?.length ?? 0) > 0)
  ) ?? false
}
