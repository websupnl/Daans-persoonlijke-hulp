/**
 * Unified Session Management - Cross-channel state sharing
 * 
 * Provides consistent session state across chat, telegram, and other channels
 */

import { query, queryOne, execute } from '@/lib/db'
import { chatLogger } from './logger'
import { correlationTracker } from './correlation'

export interface UnifiedSession {
  userId: string
  sessionId: string
  channels: ChannelSession[]
  lastDomain: string | null
  lastResult: LastResult | null
  pendingAction: PendingAction | null
  contextStack: ContextItem[]
  expectedInput: ExpectedInput | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

export interface ChannelSession {
  channel: 'chat' | 'telegram' | 'api' | string
  sessionId: string
  lastActivity: Date
  metadata: Record<string, any>
}

export interface LastResult {
  domain: string
  period?: string
  transactionIds?: number[]
  total?: number
  itemCount?: number
  summary?: string
  data?: any
  timestamp: Date
}

export interface PendingAction {
  id: string
  type: string
  payload: Record<string, any>
  confirmationPrompt: string
  createdAt: Date
  expiresAt: Date
}

export interface ContextItem {
  id: string
  type: string
  data: any
  timestamp: Date
  expiresAt?: Date
}

export interface ExpectedInput {
  type: 'confirmation' | 'text' | 'number' | 'date' | 'choice'
  prompt?: string
  options?: string[]
  validation?: ValidationRule[]
}

export interface ValidationRule {
  field: string
  required: boolean
  type: 'string' | 'number' | 'boolean' | 'date'
  pattern?: string
  min?: number
  max?: number
}

class UnifiedSessionManager {
  private static instance: UnifiedSessionManager
  
  static getInstance(): UnifiedSessionManager {
    if (!UnifiedSessionManager.instance) {
      UnifiedSessionManager.instance = new UnifiedSessionManager()
    }
    return UnifiedSessionManager.instance
  }

  generateSessionKey(userId: string, channel: string): string {
    return `${userId}:${channel}:default`
  }

  generateUnifiedSessionId(userId: string): string {
    return `unified_${userId}_${Date.now()}`
  }

  async getOrCreateSession(
    userId: string,
    channel: string,
    metadata: Record<string, any> = {}
  ): Promise<UnifiedSession> {
    const channelSessionId = this.generateSessionKey(userId, channel)
    
    // Try to get existing unified session
    let unifiedSession = await this.getUnifiedSession(userId)
    
    if (!unifiedSession) {
      // Create new unified session
      unifiedSession = await this.createUnifiedSession(userId, channel, metadata)
    } else {
      // Update channel session
      await this.updateChannelSession(unifiedSession.sessionId, channel, channelSessionId, metadata)
    }
    
    return unifiedSession
  }

  async getUnifiedSession(userId: string): Promise<UnifiedSession | null> {
    try {
      const row = await queryOne<{
        user_id: string
        session_id: string
        last_domain: string | null
        last_result: Record<string, unknown>
        pending_action: Record<string, unknown> | null
        context_stack: Record<string, unknown>[]
        expected_input: Record<string, unknown> | null
        created_at: string
        updated_at: string
        expires_at: string
      }>(`
        SELECT user_id, session_id, last_domain, last_result, pending_action,
               context_stack, expected_input, created_at, updated_at, expires_at
        FROM unified_sessions
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY updated_at DESC
        LIMIT 1
      `, [userId])

      if (!row) return null

      // Get channel sessions
      const channelSessions = await this.getChannelSessions(row.session_id)

      return {
        userId: row.user_id,
        sessionId: row.session_id,
        channels: channelSessions,
        lastDomain: row.last_domain,
        lastResult: row.last_result ? this.parseLastResult(row.last_result) : null,
        pendingAction: row.pending_action ? this.parsePendingAction(row.pending_action) : null,
        contextStack: (row.context_stack || []).map(item => this.parseContextItem(item)),
        expectedInput: row.expected_input ? this.parseExpectedInput(row.expected_input) : null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        expiresAt: new Date(row.expires_at)
      }
    } catch (err) {
      console.error('[UnifiedSessionManager] Failed to get unified session:', err)
      return null
    }
  }

  async updateSession(
    userId: string,
    updates: Partial<UnifiedSession>,
    correlationId: string
  ): Promise<void> {
    try {
      const session = await this.getUnifiedSession(userId)
      if (!session) {
        throw new Error('Unified session not found')
      }

      const updateFields: string[] = []
      const updateValues: any[] = []
      let paramIndex = 1

      if (updates.lastDomain !== undefined) {
        updateFields.push(`last_domain = $${paramIndex}`)
        updateValues.push(updates.lastDomain)
        paramIndex++
      }

      if (updates.lastResult !== undefined) {
        updateFields.push(`last_result = $${paramIndex}`)
        updateValues.push(JSON.stringify(updates.lastResult))
        paramIndex++
      }

      if (updates.pendingAction !== undefined) {
        updateFields.push(`pending_action = $${paramIndex}`)
        updateValues.push(JSON.stringify(updates.pendingAction))
        paramIndex++
      }

      if (updates.contextStack !== undefined) {
        updateFields.push(`context_stack = $${paramIndex}`)
        updateValues.push(JSON.stringify(updates.contextStack))
        paramIndex++
      }

      if (updates.expectedInput !== undefined) {
        updateFields.push(`expected_input = $${paramIndex}`)
        updateValues.push(JSON.stringify(updates.expectedInput))
        paramIndex++
      }

      if (updateFields.length === 0) return

      updateFields.push(`updated_at = NOW()`)
      updateValues.push(session.sessionId)

      await execute(`
        UPDATE unified_sessions
        SET ${updateFields.join(', ')}
        WHERE session_id = $${paramIndex}
      `, updateValues)

      await chatLogger.logPhase(correlationId, 'session_update', {
        sessionId: session.sessionId,
        updates: Object.keys(updates)
      })
    } catch (err) {
      console.error('[UnifiedSessionManager] Failed to update session:', err)
      throw err
    }
  }

  async getContext(userId: string, channel: string): Promise<any> {
    const session = await this.getUnifiedSession(userId)
    if (!session) return {}

    const channelSession = session.channels.find(ch => ch.channel === channel)
    return {
      unifiedSession: session,
      channelSession,
      lastDomain: session.lastDomain,
      lastResult: session.lastResult,
      pendingAction: session.pendingAction,
      contextStack: session.contextStack,
      expectedInput: session.expectedInput
    }
  }

  async shareContextAcrossChannels(
    userId: string,
    context: any,
    excludeChannel?: string
  ): Promise<void> {
    const session = await this.getUnifiedSession(userId)
    if (!session) return

    const targetChannels = session.channels.filter(ch => ch.channel !== excludeChannel)
    
    for (const channel of targetChannels) {
      // Update channel-specific context
      await this.updateChannelContext(channel.channel, context)
    }
  }

  async mergeContext(userId: string, newContext: any): Promise<void> {
    const session = await this.getUnifiedSession(userId)
    if (!session) return

    // Merge with existing context
    const mergedContext = {
      ...session.contextStack[session.contextStack.length - 1]?.data,
      ...newContext
    }

    const contextItem: ContextItem = {
      id: `ctx_${Date.now()}`,
      type: 'merged',
      data: mergedContext,
      timestamp: new Date()
    }

    session.contextStack.push(contextItem)
    
    await this.updateSession(userId, {
      contextStack: session.contextStack
    }, '')
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await execute(`
        DELETE FROM unified_sessions
        WHERE expires_at <= NOW()
      `)
      
      return result.rowCount || 0
    } catch (err) {
      console.error('[UnifiedSessionManager] Failed to cleanup expired sessions:', err)
      return 0
    }
  }

  async getSessionStats(): Promise<{
    totalSessions: number
    activeSessions: number
    channelDistribution: Record<string, number>
    averageSessionDuration: number
  }> {
    try {
      const stats = await query<{
        total_sessions: number
        active_sessions: number
        channel_distribution: Record<string, number>
        avg_duration: number
      }>(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_sessions,
          json_object_agg(channel, channel_count) as channel_distribution,
          AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_duration
        FROM (
          SELECT 
            us.session_id,
            us.expires_at,
            us.created_at,
            cs.channel,
            COUNT(*) as channel_count
          FROM unified_sessions us
          LEFT JOIN channel_sessions cs ON us.session_id = cs.unified_session_id
          WHERE us.created_at >= NOW() - INTERVAL '7 days'
          GROUP BY us.session_id, us.expires_at, us.created_at, cs.channel
        ) subquery
      `)

      return {
        totalSessions: stats[0]?.total_sessions || 0,
        activeSessions: stats[0]?.active_sessions || 0,
        channelDistribution: stats[0]?.channel_distribution || {},
        averageSessionDuration: stats[0]?.avg_duration || 0
      }
    } catch (err) {
      console.error('[UnifiedSessionManager] Failed to get session stats:', err)
      return {
        totalSessions: 0,
        activeSessions: 0,
        channelDistribution: {},
        averageSessionDuration: 0
      }
    }
  }

  private async createUnifiedSession(
    userId: string,
    channel: string,
    metadata: Record<string, any>
  ): Promise<UnifiedSession> {
    const sessionId = this.generateUnifiedSessionId(userId)
    const channelSessionId = this.generateSessionKey(userId, channel)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

    // Create unified session
    await execute(`
      INSERT INTO unified_sessions (
        user_id, session_id, last_domain, last_result, pending_action,
        context_stack, expected_input, created_at, updated_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      userId,
      sessionId,
      null,
      null,
      null,
      '[]',
      null,
      now,
      now,
      expiresAt
    ])

    // Create channel session
    await this.createChannelSession(sessionId, channel, channelSessionId, metadata)

    return {
      userId,
      sessionId,
      channels: [{
        channel,
        sessionId: channelSessionId,
        lastActivity: now,
        metadata
      }],
      lastDomain: null,
      lastResult: null,
      pendingAction: null,
      contextStack: [],
      expectedInput: null,
      createdAt: now,
      updatedAt: now,
      expiresAt
    }
  }

  private async createChannelSession(
    unifiedSessionId: string,
    channel: string,
    channelSessionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await execute(`
      INSERT INTO channel_sessions (
        unified_session_id, channel, session_id, last_activity, metadata
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (unified_session_id, channel) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        last_activity = EXCLUDED.last_activity,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [unifiedSessionId, channel, channelSessionId, new Date(), JSON.stringify(metadata)])
  }

  private async updateChannelSession(
    unifiedSessionId: string,
    channel: string,
    channelSessionId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await execute(`
      UPDATE channel_sessions
      SET session_id = $1, last_activity = NOW(), metadata = $2, updated_at = NOW()
      WHERE unified_session_id = $3 AND channel = $4
    `, [channelSessionId, JSON.stringify(metadata), unifiedSessionId, channel])
  }

  private async updateChannelContext(channel: string, context: any): Promise<void> {
    // Implementation would update channel-specific context
    // For now, this is a placeholder
  }

  private async getChannelSessions(unifiedSessionId: string): Promise<ChannelSession[]> {
    try {
      const sessions = await query<{
        channel: string
        session_id: string
        last_activity: string
        metadata: Record<string, unknown>
      }>(`
        SELECT channel, session_id, last_activity, metadata
        FROM channel_sessions
        WHERE unified_session_id = $1
        ORDER BY last_activity DESC
      `, [unifiedSessionId])

      return sessions.map(session => ({
        channel: session.channel,
        sessionId: session.session_id,
        lastActivity: new Date(session.last_activity),
        metadata: typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata
      }))
    } catch (err) {
      console.error('[UnifiedSessionManager] Failed to get channel sessions:', err)
      return []
    }
  }

  private parseLastResult(data: Record<string, unknown>): LastResult {
    return {
      domain: data.domain as string,
      period: data.period as string,
      transactionIds: data.transactionIds as number[],
      total: data.total as number,
      itemCount: data.itemCount as number,
      summary: data.summary as string,
      data: data.data,
      timestamp: new Date(data.timestamp as string)
    }
  }

  private parsePendingAction(data: Record<string, unknown>): PendingAction {
    return {
      id: data.id as string,
      type: data.type as string,
      payload: data.payload as Record<string, any>,
      confirmationPrompt: data.confirmationPrompt as string,
      createdAt: new Date(data.createdAt as string),
      expiresAt: new Date(data.expiresAt as string)
    }
  }

  private parseContextItem(data: Record<string, unknown>): ContextItem {
    return {
      id: data.id as string,
      type: data.type as string,
      data: data.data,
      timestamp: new Date(data.timestamp as string),
      expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined
    }
  }

  private parseExpectedInput(data: Record<string, unknown>): ExpectedInput {
    return {
      type: data.type as ExpectedInput['type'],
      prompt: data.prompt as string,
      options: data.options as string[],
      validation: data.validation as ValidationRule[]
    }
  }
}

export const unifiedSessionManager = UnifiedSessionManager.getInstance()
