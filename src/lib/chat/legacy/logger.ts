/**
 * Comprehensive Chat Logging System
 * 
 * Provides detailed logging for all chat pipeline phases with correlation tracking
 */

import { execute, query } from '@/lib/db'
import { correlationTracker, CorrelationLog } from '../correlation'

export interface ChatLog {
  correlationId: string
  timestamp: Date
  phase: 'intake' | 'parsing' | 'routing' | 'planning' | 'execution' | 'verification' | 'response'
  data: any
  success: boolean
  error?: string
  duration?: number
  metadata?: Record<string, any>
}

export interface LogContext {
  correlationId: string
  sessionId: string
  userId?: string
  channel: string
  messageContent?: string
  intent?: string
  domain?: string
}

class ChatLogger {
  private static instance: ChatLogger
  
  static getInstance(): ChatLogger {
    if (!ChatLogger.instance) {
      ChatLogger.instance = new ChatLogger()
    }
    return ChatLogger.instance
  }

  async logIntake(context: LogContext, message: string): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'intake', {
      message,
      sessionId: context.sessionId,
      channel: context.channel,
      userId: context.userId
    })

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'intake',
      data: { message, sessionId: context.sessionId, channel: context.channel },
      success: true,
      duration: Date.now() - startTime
    })
  }

  async logParsing(context: LogContext, parseResult: {
    intent: string
    domain: string
    confidence: number
    entities: any
    parserType: string
  }): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'parsing', parseResult)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'parsing',
      data: parseResult,
      success: true,
      duration: Date.now() - startTime
    })
  }

  async logRouting(context: LogContext, routingResult: {
    selectedDomain: string
    confidence: number
    alternativeDomains: string[]
    routingReason: string
  }): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'routing', routingResult)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'routing',
      data: routingResult,
      success: true,
      duration: Date.now() - startTime
    })
  }

  async logPlanning(context: LogContext, planResult: {
    actionPlan: any
    requiresConfirmation: boolean
    confirmationPrompt?: string
    estimatedDuration: number
  }): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'planning', planResult)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'planning',
      data: planResult,
      success: true,
      duration: Date.now() - startTime
    })
  }

  async logExecution(context: LogContext, executionResult: {
    actions: any[]
    results: any[]
    success: boolean
    error?: string
    executionTime: number
  }): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'execution', executionResult)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'execution',
      data: executionResult,
      success: executionResult.success,
      error: executionResult.error,
      duration: Date.now() - startTime
    })
  }

  async logVerification(context: LogContext, verificationResult: {
    verified: boolean
    verificationDetails?: any
    writeResults?: any[]
    success: boolean
    error?: string
  }): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'verification', verificationResult)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'verification',
      data: verificationResult,
      success: verificationResult.success,
      error: verificationResult.error,
      duration: Date.now() - startTime
    })
  }

  async logResponse(context: LogContext, responseResult: {
    reply: string
    actions: any[]
    success: boolean
    error?: string
    responseTime: number
    truthful: boolean
    dataVerified: boolean
  }): Promise<void> {
    const startTime = Date.now()
    
    await correlationTracker.logPhase(context.correlationId, 'response', responseResult)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: 'response',
      data: responseResult,
      success: responseResult.success,
      error: responseResult.error,
      duration: Date.now() - startTime,
      metadata: {
        truthful: responseResult.truthful,
        dataVerified: responseResult.dataVerified
      }
    })
  }

  async logError(context: LogContext, phase: string, error: Error, additionalData?: any): Promise<void> {
    const errorData = {
      errorMessage: error.message,
      errorStack: error.stack,
      phase,
      additionalData
    }

    await correlationTracker.logPhase(context.correlationId, phase as any, errorData)

    await this.storeLog({
      correlationId: context.correlationId,
      timestamp: new Date(),
      phase: phase as any,
      data: errorData,
      success: false,
      error: error.message
    })
  }

  private async storeLog(log: ChatLog): Promise<void> {
    try {
      await execute(`
        INSERT INTO chat_log (
          correlation_id, timestamp, phase, data, success, error, duration, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        log.correlationId,
        log.timestamp,
        log.phase,
        JSON.stringify(log.data),
        log.success,
        log.error,
        log.duration,
        log.metadata ? JSON.stringify(log.metadata) : null
      ])
    } catch (err) {
      console.error('[ChatLogger] Failed to store log:', err)
    }
  }

  async getFullTrace(correlationId: string): Promise<ChatLog[]> {
    try {
      const logs = await query<ChatLog>(`
        SELECT correlation_id, timestamp, phase, data, success, error, duration, metadata
        FROM chat_log 
        WHERE correlation_id = $1 
        ORDER BY timestamp ASC
      `, [correlationId])
      
      return logs
    } catch (err) {
      console.error('[ChatLogger] Failed to get trace:', err)
      return []
    }
  }

  async getSessionLogs(sessionId: string, limit: number = 100): Promise<ChatLog[]> {
    try {
      const logs = await query<ChatLog>(`
        SELECT cl.correlation_id, cl.timestamp, cl.phase, cl.data, cl.success, cl.error, cl.duration, cl.metadata
        FROM chat_log cl
        JOIN correlation_context cc ON cl.correlation_id = cc.correlation_id
        WHERE cc.session_id = $1 
        ORDER BY cl.timestamp DESC 
        LIMIT $2
      `, [sessionId, limit])
      
      return logs
    } catch (err) {
      console.error('[ChatLogger] Failed to get session logs:', err)
      return []
    }
  }

  async getErrorLogs(limit: number = 50): Promise<ChatLog[]> {
    try {
      const logs = await query<ChatLog>(`
        SELECT correlation_id, timestamp, phase, data, success, error, duration, metadata
        FROM chat_log 
        WHERE success = false 
        ORDER BY timestamp DESC 
        LIMIT $1
      `, [limit])
      
      return logs
    } catch (err) {
      console.error('[ChatLogger] Failed to get error logs:', err)
      return []
    }
  }

  async getPerformanceStats(phase?: string, hours: number = 24): Promise<{
    avgDuration: number
    successRate: number
    totalRequests: number
    errorCount: number
  }> {
    try {
      const whereClause = phase ? 'AND phase = $2' : ''
      const params = phase ? [hours, phase] : [hours]
      
      const stats = await query<{
        avg_duration: number
        success_rate: number
        total_requests: number
        error_count: number
      }>(`
        SELECT 
          AVG(duration) as avg_duration,
          COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*) as success_rate,
          COUNT(*) as total_requests,
          COUNT(CASE WHEN success = false THEN 1 END) as error_count
        FROM chat_log 
        WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
        ${whereClause}
      `, params)
      
      const stat = stats[0]
      return {
        avgDuration: stat?.avg_duration || 0,
        successRate: stat?.success_rate || 0,
        totalRequests: stat?.total_requests || 0,
        errorCount: stat?.error_count || 0
      }
    } catch (err) {
      console.error('[ChatLogger] Failed to get performance stats:', err)
      return { avgDuration: 0, successRate: 0, totalRequests: 0, errorCount: 0 }
    }
  }
}

export const chatLogger = ChatLogger.getInstance()
