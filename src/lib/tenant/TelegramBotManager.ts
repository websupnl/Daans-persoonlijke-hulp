import { TenantManager } from './TenantManager'
import { TenantContextManager } from './TenantContext'

export interface TelegramBotConfig {
  token: string
  username: string
  webhook_url: string
  tenant_id: string
}

export class TelegramBotManager {
  private static instance: TelegramBotManager
  private tenantManager: TenantManager
  private contextManager: TenantContextManager
  private botConfigs: Map<string, TelegramBotConfig> = new Map()

  constructor() {
    this.tenantManager = TenantManager.getInstance()
    this.contextManager = TenantContextManager.getInstance()
  }

  static getInstance(): TelegramBotManager {
    if (!TelegramBotManager.instance) {
      TelegramBotManager.instance = new TelegramBotManager()
    }
    return TelegramBotManager.instance
  }

  /**
   * Initialize all tenant bots
   */
  async initializeBots(): Promise<void> {
    const tenants = await this.tenantManager.getAllTenants()
    
    for (const tenant of tenants) {
      if (tenant.telegram_bot_token && tenant.telegram_bot_username) {
        const config: TelegramBotConfig = {
          token: tenant.telegram_bot_token,
          username: tenant.telegram_bot_username,
          webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/telegram/webhook/${tenant.id}`,
          tenant_id: tenant.id
        }
        
        this.botConfigs.set(tenant.id, config)
        await this.setupWebhook(config)
      }
    }
  }

  /**
   * Setup webhook for specific bot
   */
  private async setupWebhook(config: TelegramBotConfig): Promise<void> {
    try {
      const webhookUrl = `https://api.telegram.org/bot${config.token}/setWebhook`
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: config.webhook_url,
          allowed_updates: ['message', 'callback_query']
        })
      })

      const result = await response.json()
      
      if (result.ok) {
        console.log(`Webhook set for bot ${config.username} (${config.tenant_id})`)
      } else {
        console.error(`Failed to set webhook for bot ${config.username}:`, result.description)
      }
    } catch (error) {
      console.error(`Error setting webhook for bot ${config.username}:`, error)
    }
  }

  /**
   * Get bot config by tenant ID
   */
  getBotConfig(tenantId: string): TelegramBotConfig | undefined {
    return this.botConfigs.get(tenantId)
  }

  /**
   * Get bot config by Telegram user ID
   */
  async getBotConfigByTelegramUserId(telegramUserId: string): Promise<TelegramBotConfig | undefined> {
    const tenant = await this.tenantManager.getTenantByTelegramUserId(telegramUserId)
    if (!tenant) return undefined

    return this.getBotConfig(tenant.id)
  }

  /**
   * Send message to specific user via their tenant's bot
   */
  async sendMessageToUser(telegramUserId: string, message: string, options?: {
    parse_mode?: 'HTML' | 'Markdown'
    reply_markup?: any
  }): Promise<boolean> {
    const config = await this.getBotConfigByTelegramUserId(telegramUserId)
    if (!config) {
      console.error(`No bot config found for Telegram user ${telegramUserId}`)
      return false
    }

    try {
      const apiUrl = `https://api.telegram.org/bot${config.token}/sendMessage`
      
      const payload: any = {
        chat_id: telegramUserId,
        text: message,
      }

      if (options?.parse_mode) {
        payload.parse_mode = options.parse_mode
      }

      if (options?.reply_markup) {
        payload.reply_markup = options.reply_markup
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (result.ok) {
        return true
      } else {
        console.error(`Failed to send message to ${telegramUserId}:`, result.description)
        return false
      }
    } catch (error) {
      console.error(`Error sending message to ${telegramUserId}:`, error)
      return false
    }
  }

  /**
   * Process incoming Telegram update
   */
  async processUpdate(update: any): Promise<void> {
    const context = await this.contextManager.getContextFromTelegramUpdate(update)
    if (!context) {
      console.error('No tenant context found for Telegram update')
      return
    }

    // Route to appropriate handler based on update type
    if (update.message) {
      await this.handleMessage(update.message, context)
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query, context)
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: any, context: any): Promise<void> {
    const text = message.text
    const telegramUserId = message.from.id.toString()

    // Route to chat processor with tenant context
    const chatResponse = await this.processChatMessage(text, context)
    
    if (chatResponse) {
      await this.sendMessageToUser(telegramUserId, chatResponse.message, {
        parse_mode: 'HTML',
        reply_markup: chatResponse.reply_markup
      })
    }
  }

  /**
   * Handle callback query
   */
  private async handleCallbackQuery(callbackQuery: any, context: any): Promise<void> {
    const data = callbackQuery.data
    const telegramUserId = callbackQuery.from.id.toString()
    const messageId = callbackQuery.message.message_id

    // Process callback and send response
    const response = await this.processCallback(data, context)
    
    // Edit message or send new one
    if (response.edit_message) {
      await this.editMessage(telegramUserId, messageId, response.message, {
        parse_mode: 'HTML',
        reply_markup: response.reply_markup
      })
    } else {
      await this.sendMessageToUser(telegramUserId, response.message, {
        parse_mode: 'HTML',
        reply_markup: response.reply_markup
      })
    }
  }

  /**
   * Process chat message with tenant context
   */
  private async processChatMessage(message: string, context: any): Promise<any> {
    const { parseCommandWithAI } = await import('../ai/parse-command')
    const { executeActions } = await import('../ai/execute-actions')
    const { generateAIResponse } = await import('../ai/generate-response')
    const aiResult = await parseCommandWithAI(message)
    if (!aiResult) return { reply: 'Kon het bericht niet verwerken.', message: 'Kon het bericht niet verwerken.', actions: [] }
    const actionResults = aiResult.requires_confirmation ? [] : await executeActions(aiResult.actions)
    const reply = generateAIResponse(aiResult, actionResults, aiResult.requires_confirmation)
    return { reply, message: reply, actions: actionResults }
  }

  /**
   * Process callback query
   */
  private async processCallback(data: string, context: any): Promise<any> {
    // Handle different callback types
    const [action, ...params] = data.split(':')

    switch (action) {
      case 'confirm':
        return await this.handleConfirmation(params[0], context)
      case 'cancel':
        return await this.handleCancellation(params[0], context)
      default:
        return {
          message: 'Onbekende actie',
          edit_message: false
        }
    }
  }

  /**
   * Handle confirmation callback
   */
  private async handleConfirmation(actionId: string, context: any): Promise<any> {
    // Implement confirmation logic
    return {
      message: 'Actie bevestigd! Ik ga dit voor je verwerken.',
      edit_message: true
    }
  }

  /**
   * Handle cancellation callback
   */
  private async handleCancellation(actionId: string, context: any): Promise<any> {
    // Implement cancellation logic
    return {
      message: 'Actie geannuleerd.',
      edit_message: true
    }
  }

  /**
   * Edit message
   */
  private async editMessage(telegramUserId: string, messageId: number, text: string, options?: {
    parse_mode?: 'HTML' | 'Markdown'
    reply_markup?: any
  }): Promise<boolean> {
    const config = await this.getBotConfigByTelegramUserId(telegramUserId)
    if (!config) return false

    try {
      const apiUrl = `https://api.telegram.org/bot${config.token}/editMessageText`
      
      const payload: any = {
        chat_id: telegramUserId,
        message_id: messageId,
        text: text,
      }

      if (options?.parse_mode) {
        payload.parse_mode = options.parse_mode
      }

      if (options?.reply_markup) {
        payload.reply_markup = options.reply_markup
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      return result.ok
    } catch (error) {
      console.error('Error editing message:', error)
      return false
    }
  }

  /**
   * Get all bot statuses
   */
  async getBotStatuses(): Promise<Record<string, boolean>> {
    const statuses: Record<string, boolean> = {}

    for (const [tenantId, config] of Array.from(this.botConfigs.entries())) {
      try {
        const apiUrl = `https://api.telegram.org/bot${config.token}/getMe`
        const response = await fetch(apiUrl)
        const result = await response.json()
        statuses[tenantId] = result.ok
      } catch (error) {
        statuses[tenantId] = false
      }
    }

    return statuses
  }
}
