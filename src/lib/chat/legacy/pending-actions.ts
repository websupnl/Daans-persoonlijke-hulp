/**
 * Pending Action System - Robust confirmation flow
 * 
 * Manages pending actions across chat sessions with cross-channel support
 */

import { execute, query, queryOne } from '@/lib/db'
import { correlationTracker } from '../correlation'
import { chatLogger } from './logger'

export interface PendingAction {
  id: string
  sessionId: string
  actionType: string
  payload: Record<string, any>
  confirmationPrompt: string
  createdAt: Date
  expiresAt: Date
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'failed'
  correlationId: string
  metadata?: Record<string, any>
}

export interface ConfirmationResult {
  success: boolean
  actionId: string
  result?: any
  error?: string
  executionTime: number
}

export interface ActionPlan {
  id: string
  actions: Action[]
  requiresConfirmation: boolean
  confirmationPrompt?: string
  validationRules: ValidationRule[]
  estimatedDuration: number
}

export interface Action {
  type: string
  payload: Record<string, any>
  validation?: ValidationRule[]
  timeout?: number
}

export interface ValidationRule {
  field: string
  required: boolean
  type: 'string' | 'number' | 'boolean' | 'date'
  pattern?: string
  min?: number
  max?: number
}

export interface ExpectedInput {
  type: 'confirmation' | 'text' | 'number' | 'date' | 'choice'
  prompt?: string
  options?: string[]
  validation?: ValidationRule[]
}

class PendingActionManager {
  private static instance: PendingActionManager
  
  static getInstance(): PendingActionManager {
    if (!PendingActionManager.instance) {
      PendingActionManager.instance = new PendingActionManager()
    }
    return PendingActionManager.instance
  }

  generateId(): string {
    return `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async createPendingAction(
    sessionId: string,
    action: Action,
    correlationId: string,
    options: {
      confirmationPrompt?: string
      expiresMinutes?: number
      metadata?: Record<string, any>
    } = {}
  ): Promise<string> {
    const actionId = this.generateId()
    const expiresMinutes = options.expiresMinutes || 5
    
    const pendingAction: PendingAction = {
      id: actionId,
      sessionId,
      actionType: action.type,
      payload: action.payload,
      confirmationPrompt: options.confirmationPrompt || this.generatePrompt(action),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
      status: 'pending',
      correlationId,
      metadata: options.metadata
    }

    await this.storePendingAction(pendingAction)
    await correlationTracker.trackAction(correlationId, {
      type: action.type,
      payload: action.payload
    })

    await chatLogger.logPlanning(
      { correlationId, sessionId, channel: 'unknown' },
      {
        actionPlan: { actions: [action], requiresConfirmation: true },
        requiresConfirmation: true,
        confirmationPrompt: pendingAction.confirmationPrompt,
        estimatedDuration: action.timeout || 30000
      }
    )

    return actionId
  }

  async handleConfirmation(
    sessionId: string,
    response: 'yes' | 'no' | 'cancel' | 'retry',
    correlationId: string
  ): Promise<ConfirmationResult> {
    const startTime = Date.now()
    
    try {
      const pending = await this.getPendingAction(sessionId)
      if (!pending) {
        return {
          success: false,
          actionId: '',
          error: 'No pending action found',
          executionTime: Date.now() - startTime
        }
      }

      // Check if expired
      if (pending.expiresAt < new Date()) {
        await this.updateStatus(pending.id, 'expired')
        return {
          success: false,
          actionId: pending.id,
          error: 'Pending action expired',
          executionTime: Date.now() - startTime
        }
      }

      let result: ConfirmationResult

      switch (response) {
        case 'yes':
          result = await this.executePendingAction(pending, correlationId)
          if (result.success) {
            await this.updateStatus(pending.id, 'confirmed')
          } else {
            await this.updateStatus(pending.id, 'failed')
          }
          break
          
        case 'no':
        case 'cancel':
          await this.updateStatus(pending.id, 'cancelled')
          result = {
            success: false,
            actionId: pending.id,
            error: 'Action cancelled by user',
            executionTime: Date.now() - startTime
          }
          break
          
        case 'retry':
          result = await this.executePendingAction(pending, correlationId)
          if (result.success) {
            await this.updateStatus(pending.id, 'confirmed')
          } else {
            await this.updateStatus(pending.id, 'failed')
          }
          break
          
        default:
          result = {
            success: false,
            actionId: pending.id,
            error: 'Unknown response type',
            executionTime: Date.now() - startTime
          }
      }

      await chatLogger.logExecution(
        { correlationId, sessionId, channel: 'unknown' },
        {
          actions: [{ type: pending.actionType, payload: pending.payload }],
          results: [result],
          success: result.success,
          error: result.error,
          executionTime: result.executionTime
        }
      )

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      await chatLogger.logError(
        { correlationId, sessionId, channel: 'unknown' },
        'confirmation',
        err as Error,
        { response }
      )
      
      return {
        success: false,
        actionId: '',
        error,
        executionTime: Date.now() - startTime
      }
    }
  }

  async getPendingAction(sessionId: string): Promise<PendingAction | null> {
    try {
      const row = await queryOne<{
        id: string
        session_id: string
        action_type: string
        payload: Record<string, unknown>
        confirmation_prompt: string
        created_at: string
        expires_at: string
        status: string
        correlation_id: string
        metadata: Record<string, unknown>
      }>(`
        SELECT id, session_id, action_type, payload, confirmation_prompt, 
               created_at, expires_at, status, correlation_id, metadata
        FROM pending_actions
        WHERE session_id = $1 AND status = 'pending' AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [sessionId])

      if (!row) return null

      return {
        id: row.id,
        sessionId: row.session_id,
        actionType: row.action_type,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload as string) : row.payload,
        confirmationPrompt: row.confirmation_prompt,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        status: row.status as PendingAction['status'],
        correlationId: row.correlation_id,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata as string) : row.metadata
      }
    } catch (err) {
      console.error('[PendingActionManager] Failed to get pending action:', err)
      return null
    }
  }

  async getPendingActionById(actionId: string): Promise<PendingAction | null> {
    try {
      const row = await queryOne<{
        id: string
        session_id: string
        action_type: string
        payload: Record<string, unknown>
        confirmation_prompt: string
        created_at: string
        expires_at: string
        status: string
        correlation_id: string
        metadata: Record<string, unknown>
      }>(`
        SELECT id, session_id, action_type, payload, confirmation_prompt, 
               created_at, expires_at, status, correlation_id, metadata
        FROM pending_actions
        WHERE id = $1
      `, [actionId])

      if (!row) return null

      return {
        id: row.id,
        sessionId: row.session_id,
        actionType: row.action_type,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload as string) : row.payload,
        confirmationPrompt: row.confirmation_prompt,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
        status: row.status as PendingAction['status'],
        correlationId: row.correlation_id,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata as string) : row.metadata
      }
    } catch (err) {
      console.error('[PendingActionManager] Failed to get pending action by ID:', err)
      return null
    }
  }

  async executePendingAction(pending: PendingAction, correlationId: string): Promise<ConfirmationResult> {
    const startTime = Date.now()
    
    try {
      // Import executeActions dynamically to avoid circular dependencies
      const { executeActions } = await import('@/lib/ai/execute-actions')
      
      const action = {
        type: pending.actionType as any,
        payload: pending.payload
      }

      const results = await executeActions([action as any])
      const result = results[0]

      await correlationTracker.trackWrite(correlationId, {
        success: result.success,
        data: result.data,
        error: result.error,
        writeId: pending.id
      })

      return {
        success: result.success,
        actionId: pending.id,
        result: result.data,
        error: result.error,
        executionTime: Date.now() - startTime
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      return {
        success: false,
        actionId: pending.id,
        error,
        executionTime: Date.now() - startTime
      }
    }
  }

  async updateStatus(actionId: string, status: PendingAction['status']): Promise<void> {
    try {
      await execute(`
        UPDATE pending_actions 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [status, actionId])
    } catch (err) {
      console.error('[PendingActionManager] Failed to update status:', err)
    }
  }

  async cancelExpiredActions(): Promise<number> {
    try {
      const result = await execute(`
        UPDATE pending_actions 
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'pending' AND expires_at <= NOW()
      `)
      
      return result || 0
    } catch (err) {
      console.error('[PendingActionManager] Failed to cancel expired actions:', err)
      return 0
    }
  }

  async cleanupOldActions(daysOld: number = 7): Promise<number> {
    try {
      const result = await execute(`
        DELETE FROM pending_actions 
        WHERE updated_at < NOW() - INTERVAL '${daysOld} days'
      `)
      
      return result || 0
    } catch (err) {
      console.error('[PendingActionManager] Failed to cleanup old actions:', err)
      return 0
    }
  }

  async getPendingActionsStats(): Promise<{
    total: number
    pending: number
    confirmed: number
    cancelled: number
    expired: number
    failed: number
  }> {
    try {
      const stats = await query<{
        total: number
        pending: number
        confirmed: number
        cancelled: number
        expired: number
        failed: number
      }>(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM pending_actions
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `)

      return stats[0] || {
        total: 0,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        expired: 0,
        failed: 0
      }
    } catch (err) {
      console.error('[PendingActionManager] Failed to get stats:', err)
      return {
        total: 0,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        expired: 0,
        failed: 0
      }
    }
  }

  private async storePendingAction(action: PendingAction): Promise<void> {
    try {
      await execute(`
        INSERT INTO pending_actions (
          id, session_id, action_type, payload, confirmation_prompt,
          created_at, expires_at, status, correlation_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          action_type = EXCLUDED.action_type,
          payload = EXCLUDED.payload,
          confirmation_prompt = EXCLUDED.confirmation_prompt,
          expires_at = EXCLUDED.expires_at,
          status = EXCLUDED.status,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        action.id,
        action.sessionId,
        action.actionType,
        JSON.stringify(action.payload),
        action.confirmationPrompt,
        action.createdAt,
        action.expiresAt,
        action.status,
        action.correlationId,
        JSON.stringify(action.metadata || {})
      ])
    } catch (err) {
      console.error('[PendingActionManager] Failed to store pending action:', err)
      throw err
    }
  }

  private generatePrompt(action: Action): string {
    const prompts: Record<string, string> = {
      'todo_create': 'Wil je dat ik deze taak aanmaak?',
      'finance_create': 'Wil je dat ik deze uitgave registreer?',
      'reminder_create': 'Wil je dat ik een herinnering instel?',
      'note_create': 'Wil je dat ik deze notitie opsla?',
      'worklog_create': 'Wil je dat ik dit werklog toevoeg?',
      'grocery_create': 'Wil je dat ik dit aan je boodschappenlijst toevoeg?'
    }

    return prompts[action.type] || 'Wil je dat ik deze actie uitvoer?'
  }

  async validateAction(action: Action): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (!action.type || action.type.trim() === '') {
      errors.push('Action type is required')
    }

    if (!action.payload || typeof action.payload !== 'object') {
      errors.push('Action payload is required and must be an object')
    }

    // Validate required fields based on action type
    const requiredFields: Record<string, string[]> = {
      'todo_create': ['title'],
      'finance_create': ['title', 'amount'],
      'reminder_create': ['title', 'reminder_time'],
      'note_create': ['content'],
      'worklog_create': ['title'],
      'grocery_create': ['title']
    }

    const fields = requiredFields[action.type] || []
    for (const field of fields) {
      if (!action.payload[field]) {
        errors.push(`Required field '${field}' is missing`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const pendingActionManager = PendingActionManager.getInstance()
