/**
 * Telegram Bot API helper
 * Uses: https://api.telegram.org/bot{TOKEN}/sendMessage
 */

const TELEGRAM_API = 'https://api.telegram.org'

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  return token
}

/** Send a plain text message to a Telegram chat */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  const token = getToken()
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[Telegram] sendMessage failed:', res.status, body)
    throw new Error(`Telegram API error ${res.status}: ${body}`)
  }
}

/** Register a webhook URL with the Telegram Bot API */
export async function setWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
  const token = getToken()
  const url = `${TELEGRAM_API}/bot${token}/setWebhook`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  })

  return res.json() as Promise<{ ok: boolean; description?: string }>
}

/** Get current webhook info */
export async function getWebhookInfo(): Promise<Record<string, unknown>> {
  const token = getToken()
  const url = `${TELEGRAM_API}/bot${token}/getWebhookInfo`
  const res = await fetch(url)
  return res.json() as Promise<Record<string, unknown>>
}

/** Extract text from a Telegram Update object */
export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from?: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }
    chat: { id: number; type: string }
    text?: string
    date: number
  }
}
