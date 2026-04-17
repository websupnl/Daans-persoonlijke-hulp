/**
 * Shared ingest engine for Telegram and future external channels.
 * Telegram-specific UI remains here, but parsing/routing now flows
 * through the central chat engine so chat + Telegram stay consistent.
 */

import { processChatMessage } from '@/lib/chat/engine'
import type { InlineKeyboardMarkup } from '@/lib/telegram/send-message'
import type { StoredAction } from '@/lib/chat/types'

export interface IngestRequest {
  message: string
  source: 'telegram' | 'chat' | string
  senderPhone?: string
  senderName?: string
}

export interface IngestResponse {
  reply: string
  actions: StoredAction[]
  parserType: string
  confidence: number
  replyMarkup?: InlineKeyboardMarkup
}

function generateTelegramUI(actions: StoredAction[]): InlineKeyboardMarkup | undefined {
  const buttons: Array<{ text: string; callback_data: string }> = []

  const hasConfirmation = actions.some(a => a.type === 'confirmation_requested')
  if (hasConfirmation) {
    buttons.push(
      { text: '✅ Ja, doe het', callback_data: 'confirm_pending' },
      { text: '❌ Nee, annuleer', callback_data: 'cancel_pending' }
    )
  }

  for (const action of actions) {
    if (action.type === 'todo_created' && action.data.id) {
      buttons.push({ text: `✓ Klaar: ${action.data.title.slice(0, 20)}`, callback_data: `todo_complete:${action.data.id}` })
    }
    if (action.type === 'worklog_created' && action.data.id) {
      buttons.push({ text: `📊 Werkstatus`, callback_data: `worklog_status:${action.data.id}` })
    }
    if (action.type === 'grocery_added' && action.data.id) {
      buttons.push({ text: `✓ ${action.data.title.slice(0, 18)}`, callback_data: `grocery_complete:${action.data.id}` })
    }
  }

  if (buttons.length === 0) return undefined

  // Group into rows of max 2 buttons
  const rows: Array<{ text: string; callback_data: string }[]> = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }

  return { inline_keyboard: rows }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/__(.*?)__/g, '_$1_')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .trim()
}

export async function ingestMessage(req: IngestRequest): Promise<IngestResponse> {
  const result = await processChatMessage({
    message: req.message,
    source: req.source,
    senderName: req.senderName,
    senderPhone: req.senderPhone,
    sessionKey: req.source === 'telegram' && req.senderPhone ? `telegram:${req.senderPhone}` : String(req.source),
  })

  return {
    reply: stripMarkdown(result.reply),
    actions: result.actions,
    parserType: result.parserType,
    confidence: result.confidence,
    replyMarkup: req.source === 'telegram' ? generateTelegramUI(result.actions) : undefined,
  }
}
