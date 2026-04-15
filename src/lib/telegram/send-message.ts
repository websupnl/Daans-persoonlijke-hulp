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

export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

export interface SendMessageOptions {
  reply_markup?: InlineKeyboardMarkup
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2'
  disable_web_page_preview?: boolean
}

/** Send a plain text message to a Telegram chat, with optional inline buttons */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: SendMessageOptions
): Promise<void> {
  const token = getToken()
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode ?? 'Markdown',
  }

  if (options?.reply_markup) {
    body.reply_markup = options.reply_markup
  }

  if (options?.disable_web_page_preview) {
    body.disable_web_page_preview = true
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const responseBody = await res.text()
    console.error('[Telegram] sendMessage failed:', res.status, responseBody)
    throw new Error(`Telegram API error ${res.status}: ${responseBody}`)
  }
}

/** Answer a callback query (required to remove the loading indicator on buttons) */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const token = getToken()
  const url = `${TELEGRAM_API}/bot${token}/answerCallbackQuery`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })

  if (!res.ok) {
    const responseBody = await res.text()
    console.error('[Telegram] answerCallbackQuery failed:', res.status, responseBody)
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
  callback_query?: {
    id: string
    from: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }
    message?: {
      message_id: number
      chat: { id: number; type: string }
    }
    data?: string
  }
}
