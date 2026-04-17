/**
 * Correlation Tracking for Chat Pipeline
 * 
 * Provides end-to-end tracing of message -> intent -> action -> result -> response
 */

import { execute, query } from '@/lib/db'

export interface CorrelationContext {
  correlationId: string
  messageId?: string
  sessionId: string
  actionId?: string
  writeId?: string
  timestamp: Date
  channel: string
  userId?: string
  phase: 'intake' | 'parsing' | 'routing' | 'planning' | 'execution' | 'verification' | 'response'
}

export interface CorrelationLog {
  correlationId: string
  timestamp: Date
  phase: string
  data: any
  success: boolean
  error?: string
  duration?: number
  metadata?: Record<string, any>
}

class CorrelationTracker {
  private static instance: CorrelationTracker
  
  static getInstance(): CorrelationTracker {
    if (!CorrelationTracker.instance) {
      CorrelationTracker.instance = new CorrelationTracker()
    }
    return CorrelationTracker.instance
  }

  generateId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async trackMessage(message: {
    id?: string
    sessionId: string
    channel: string
    userId?: string
    content: string
  }): Promise<string> {
    const correlationId = this.generateId()
    const context: CorrelationContext = {
      correlationId,
      messageId: message.id,
      sessionId: message.sessionId,
      channel: message.channel,
      userId: message.userId,
      timestamp: new Date(),
      phase: 'intake'
    }

    await this.storeContext(context)
    await this.logPhase(correlationId, 'intake', {
      messageContent: message.content,
      sessionId: message.sessionId,
      channel: message.channel
    })

    return correlationId
  }

  async trackAction(correlationId: string, action: {
    type: string
    payload: any
    intent?: string
  }): Promise<string> {
    const actionId = this.generateId()
    
    await this.updateContext(correlationId, { 
      actionId,
      phase: 'execution'
    })
    
    await this.logPhase(correlationId, 'execution', {
      actionId,
      actionType: action.type,
      actionPayload: action.payload,
      intent: action.intent
    })

    return actionId
  }

  async trackWrite(correlationId: string, writeResult: {
    success: boolean
    data?: any
    error?: string
    writeId?: string
  }): Promise<void> {
    await this.updateContext(correlationId, { 
      writeId: writeResult.writeId,
      phase: 'verification'
    })
    
    await this.logPhase(correlationId, 'verification', {
      writeSuccess: writeResult.success,
      writeData: writeResult.data,
      writeError: writeResult.error,
      writeId: writeResult.writeId
    })
  }

  async trackResponse(correlationId: string, response: {
    success: boolean
    reply: string
    actions?: any[]
    error?: string
  }): Promise<void> {
    await this.updateContext(correlationId, { 
      phase: 'response'
    })
    
    await this.logPhase(correlationId, 'response', {
      responseSuccess: response.success,
      responseReply: response.reply,
      responseActions: response.actions,
      responseError: response.error
    })
  }

  private async storeContext(context: CorrelationContext): Promise<void> {
    try {
      await execute(`
        INSERT INTO correlation_context (
          correlation_id, message_id, session_id, action_id, write_id,
          timestamp, channel, user_id, phase
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (correlation_id) DO UPDATE SET
          message_id = EXCLUDED.message_id,
          session_id = EXCLUDED.session_id,
          action_id = EXCLUDED.action_id,
          write_id = EXCLUDED.write_id,
          phase = EXCLUDED.phase,
          timestamp = EXCLUDED.timestamp
      `, [
        context.correlationId,
        context.messageId,
        context.sessionId,
        context.actionId,
        context.writeId,
        context.timestamp,
        context.channel,
        context.userId,
        context.phase
      ])
    } catch (err) {
      console.error('[CorrelationTracker] Failed to store context:', err)
    }
  }

  private async updateContext(correlationId: string, updates: Partial<CorrelationContext>): Promise<void> {
    try {
      const fields = Object.keys(updates).filter(key => updates[key as keyof CorrelationContext] !== undefined)
      if (fields.length === 0) return

      const setClause = fields.map((field, idx) => `${field} = $${idx + 2}`).join(', ')
      const values = fields.map(field => updates[field as keyof CorrelationContext])

      await execute(`
        UPDATE correlation_context 
        SET ${setClause}, timestamp = NOW()
        WHERE correlation_id = $1
      `, [correlationId, ...values])
    } catch (err) {
      console.error('[CorrelationTracker] Failed to update context:', err)
    }
  }

  async logPhase(correlationId: string, phase: string, data: any): Promise<void> {
    try {
      await execute(`
        INSERT INTO correlation_log (correlation_id, timestamp, phase, data, success)
        VALUES ($1, NOW(), $2, $3, true)
      `, [correlationId, phase, JSON.stringify(data)])
    } catch (err) {
      console.error('[CorrelationTracker] Failed to log phase:', err)
    }
  }

  async getFullTrace(correlationId: string): Promise<CorrelationLog[]> {
    try {
      const logs = await query<CorrelationLog>(`
        SELECT correlation_id, timestamp, phase, data, success, error, duration
        FROM correlation_log 
        WHERE correlation_id = $1 
        ORDER BY timestamp ASC
      `, [correlationId])
      
      return logs
    } catch (err) {
      console.error('[CorrelationTracker] Failed to get trace:', err)
      return []
    }
  }

  async getSessionTrace(sessionId: string, limit: number = 50): Promise<CorrelationLog[]> {
    try {
      const logs = await query<CorrelationLog>(`
        SELECT cl.correlation_id, cl.timestamp, cl.phase, cl.data, cl.success, cl.error, cl.duration
        FROM correlation_log cl
        JOIN correlation_context cc ON cl.correlation_id = cc.correlation_id
        WHERE cc.session_id = $1 
        ORDER BY cl.timestamp DESC 
        LIMIT $2
      `, [sessionId, limit])
      
      return logs
    } catch (err) {
      console.error('[CorrelationTracker] Failed to get session trace:', err)
      return []
    }
  }
}

export const correlationTracker = CorrelationTracker.getInstance()
