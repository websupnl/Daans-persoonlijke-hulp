/**
 * Telegram Adapter - Channel-specific formatting for Telegram bot
 */

import { ChannelAdapter } from './types'
import { InlineKeyboardMarkup } from '@/lib/telegram/send-message'

export interface TelegramResponse {
  text: string
  replyMarkup?: InlineKeyboardMarkup
  parseMode?: 'HTML' | 'Markdown'
}

export interface TelegramInput {
  message: string
  chatId: string
  userId?: string
  messageId?: number
  metadata?: Record<string, any>
}

export class TelegramAdapter implements ChannelAdapter {
  formatResponse(response: any): TelegramResponse {
    return {
      text: this.stripMarkdown(response.reply || response.text || ''),
      replyMarkup: this.generateKeyboard(response.actions || []),
      parseMode: 'HTML'
    }
  }

  parseInput(input: TelegramInput): any {
    return {
      message: input.message,
      chatId: input.chatId,
      userId: input.userId,
      messageId: input.messageId,
      metadata: input.metadata
    }
  }

  generateUI(actions: any[]): InlineKeyboardMarkup | undefined {
    return this.generateKeyboard(actions)
  }

  private stripMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      .replace(/__(.*?)__/g, '_$1_')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .trim()
  }

  private generateKeyboard(actions: any[]): InlineKeyboardMarkup | undefined {
    const buttons: Array<{ text: string; callback_data: string }> = []

    // Add confirmation buttons
    const hasConfirmation = actions.some((a: any) => a.type === 'confirmation_requested')
    if (hasConfirmation) {
      buttons.push(
        { text: 'Ja, doe het', callback_data: 'confirm_pending' },
        { text: 'Nee, annuleer', callback_data: 'cancel_pending' }
      )
    }

    // Add action-specific buttons
    for (const action of actions) {
      if (action.type === 'todo_created' && action.data?.id) {
        buttons.push({ 
          text: `Klaar: ${action.data.title?.slice(0, 20) || 'Taak'}`, 
          callback_data: `todo_complete:${action.data.id}` 
        })
      }
      if (action.type === 'worklog_created' && action.data?.id) {
        buttons.push({ 
          text: 'Werkstatus', 
          callback_data: `worklog_status:${action.data.id}` 
        })
      }
      if (action.type === 'grocery_added' && action.data?.id) {
        buttons.push({ 
          text: `Done: ${action.data.title?.slice(0, 18) || 'Item'}`, 
          callback_data: `grocery_complete:${action.data.id}` 
        })
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
}
