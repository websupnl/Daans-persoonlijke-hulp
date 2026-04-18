/**
 * Shared ingest engine for Telegram and future external channels.
 * 
 * TEMPORARILY DISABLED - Legacy dependencies moved
 * TODO: Update to work with SimpleChatProcessor
 */

import type { InlineKeyboardMarkup } from '@/lib/telegram/send-message'

export interface IngestRequest {
  message: string
  source: 'telegram' | 'chat' | string
  senderPhone?: string
  senderName?: string
}

export interface IngestResponse {
  reply: string
  actions: any[]
  parserType?: string
  confidence?: number
  keyboard?: InlineKeyboardMarkup
  replyMarkup?: InlineKeyboardMarkup
}

export async function ingestTelegramMessage(req: IngestRequest): Promise<IngestResponse> {
  return {
    reply: 'Telegram ingest temporarily disabled during chat architecture rebuild',
    actions: [],
    parserType: 'disabled',
    confidence: 0,
  }
}

// Export alias for telegram webhook compatibility
export const ingestMessage = ingestTelegramMessage
