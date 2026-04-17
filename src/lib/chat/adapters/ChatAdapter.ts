/**
 * Chat Adapter - Channel-specific formatting for web chat
 */

import { ChannelAdapter } from './types'

export interface ChatResponse {
  text: string
  actions: any[]
  metadata?: Record<string, any>
}

export interface ChatInput {
  message: string
  sessionId: string
  userId?: string
  metadata?: Record<string, any>
}

export class ChatAdapter implements ChannelAdapter {
  formatResponse(response: any): ChatResponse {
    return {
      text: response.reply || response.text || '',
      actions: response.actions || [],
      metadata: response.metadata
    }
  }

  parseInput(input: ChatInput): any {
    return {
      message: input.message,
      sessionId: input.sessionId,
      userId: input.userId,
      metadata: input.metadata
    }
  }

  generateUI(actions: any[]): any {
    // Web chat doesn't need special UI generation
    // Actions are handled by the frontend
    return null
  }
}
