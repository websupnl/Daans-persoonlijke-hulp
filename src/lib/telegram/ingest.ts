import { processChatMessage } from '@/lib/chat/legacy/engine'
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
  const result = await processChatMessage({
    message: req.message,
    source: 'telegram',
    senderPhone: req.senderPhone,
    senderName: req.senderName,
    sessionKey: req.senderPhone ? `telegram:${req.senderPhone}` : undefined,
  })

  // Build contextual keyboard based on what was done
  const replyMarkup = buildContextualKeyboard(result.intent, result.actions)

  return {
    reply: result.reply,
    actions: result.actions,
    parserType: result.parserType,
    confidence: result.confidence,
    replyMarkup,
  }
}

function buildContextualKeyboard(
  intent: string,
  actions: any[]
): InlineKeyboardMarkup | undefined {
  // After a confirmation request → show confirm/cancel buttons
  if (intent === 'ai_confirm') {
    return {
      inline_keyboard: [[
        { text: '✅ Bevestigen', callback_data: 'confirm_pending' },
        { text: '❌ Annuleren', callback_data: 'cancel_pending' },
      ]],
    }
  }

  // After adding a todo → quick complete option
  const todoCreated = actions.find((a: any) => a.type === 'todo_created')
  if (todoCreated?.data?.id) {
    return {
      inline_keyboard: [[
        { text: '✅ Direct afronden', callback_data: `todo_complete:${todoCreated.data.id}` },
        { text: '📋 Alle taken', callback_data: 'todos_overview' },
      ]],
    }
  }

  // After adding a grocery item
  const groceryAdded = actions.find((a: any) => a.type === 'grocery_added')
  if (groceryAdded) {
    return {
      inline_keyboard: [[
        { text: '🛒 Boodschappenlijst', callback_data: 'groceries_overview' },
      ]],
    }
  }

  // After a finance action
  const financeCreated = actions.find((a: any) => a.type === 'finance_created')
  if (financeCreated) {
    return {
      inline_keyboard: [[
        { text: '💰 Financiën overzicht', callback_data: 'finance_overview' },
      ]],
    }
  }

  // After a journal entry
  const journalCreated = actions.find((a: any) => a.type === 'journal_created')
  if (journalCreated) {
    return {
      inline_keyboard: [[
        { text: '💬 Vraag meer', callback_data: 'generate_question' },
        { text: '📔 Dagboek', callback_data: 'journal_start' },
      ]],
    }
  }

  // After clarification requested → show menu
  if (intent === 'clarify') {
    return {
      inline_keyboard: [
        [
          { text: '✅ Todo', callback_data: 'flow_start:todo' },
          { text: '💸 Transactie', callback_data: 'flow_start:transactie' },
          { text: '🛒 Boodschap', callback_data: 'flow_start:boodschappen' },
        ],
        [
          { text: '📔 Dagboek', callback_data: 'flow_start:dagboek' },
          { text: '⏱️ Werklog', callback_data: 'flow_start:werklog' },
          { text: '💡 Idee', callback_data: 'flow_start:idee' },
        ],
      ],
    }
  }

  return undefined
}

// Export alias for telegram webhook compatibility
export const ingestMessage = ingestTelegramMessage
