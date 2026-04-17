/**
 * Debug API for Session State Analysis
 * 
 * Provides endpoints for debugging session state and pending actions
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const pending = searchParams.get('pending')
  const active = searchParams.get('active')

  try {
    if (sessionId) {
      // Get specific session state
      const session = await queryOne<{
        session_key: string
        last_domain: string | null
        last_result: Record<string, unknown>
        updated_at: string
      }>(`
        SELECT session_key, last_domain, last_result, updated_at
        FROM conversation_session
        WHERE session_key = $1
      `, [sessionId])

      // Get pending actions for this session
      const pendingActions = await query<{
        id: string
        action_type: string
        payload: Record<string, unknown>
        confirmation_prompt: string
        created_at: string
        expires_at: string
        status: string
      }>(`
        SELECT id, action_type, payload, confirmation_prompt, created_at, expires_at, status
        FROM pending_actions
        WHERE session_id = $1 AND status = 'pending'
        ORDER BY created_at DESC
      `, [sessionId])

      // Get recent correlation logs for this session
      const recentLogs = await query<{
        correlation_id: string
        timestamp: string
        phase: string
        success: boolean
        error?: string
      }>(`
        SELECT cl.correlation_id, cl.timestamp, cl.phase, cl.success, cl.error
        FROM chat_log cl
        JOIN correlation_context cc ON cl.correlation_id = cc.correlation_id
        WHERE cc.session_id = $1
        ORDER BY cl.timestamp DESC
        LIMIT 20
      `, [sessionId])

      return NextResponse.json({
        sessionId,
        session: session ? {
          ...session,
          lastResult: typeof session.last_result === 'string' ? JSON.parse(session.last_result) : session.last_result
        } : null,
        pendingActions: pendingActions.map(action => ({
          ...action,
          payload: typeof action.payload === 'string' ? JSON.parse(action.payload) : action.payload
        })),
        recentLogs
      })
    }

    if (pending) {
      // Get all pending actions
      const pendingActions = await query<{
        id: string
        session_id: string
        action_type: string
        payload: Record<string, unknown>
        confirmation_prompt: string
        created_at: string
        expires_at: string
        status: string
      }>(`
        SELECT id, session_id, action_type, payload, confirmation_prompt, created_at, expires_at, status
        FROM pending_actions
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 50
      `)

      return NextResponse.json({
        pendingActions: pendingActions.map(action => ({
          ...action,
          payload: typeof action.payload === 'string' ? JSON.parse(action.payload) : action.payload
        }))
      })
    }

    if (active) {
      // Get all active sessions (recent activity)
      const activeSessions = await query<{
        session_key: string
        last_domain: string | null
        updated_at: string
        message_count: number
      }>(`
        SELECT 
          cs.session_key,
          cs.last_domain,
          cs.updated_at,
          COUNT(cm.id) as message_count
        FROM conversation_session cs
        LEFT JOIN chat_messages cm ON cm.content LIKE '%' || cs.session_key || '%'
        WHERE cs.updated_at >= NOW() - INTERVAL '24 hours'
        GROUP BY cs.session_key, cs.last_domain, cs.updated_at
        ORDER BY cs.updated_at DESC
        LIMIT 50
      `)

      return NextResponse.json({
        activeSessions,
        count: activeSessions.length
      })
    }

    // Default: return session state overview
    const totalSessions = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM conversation_session
      WHERE updated_at >= NOW() - INTERVAL '24 hours'
    `)

    const pendingCount = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM pending_actions
      WHERE status = 'pending' AND expires_at > NOW()
    `)

    const expiredCount = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM pending_actions
      WHERE status = 'pending' AND expires_at <= NOW()
    `)

    return NextResponse.json({
      overview: {
        totalActiveSessions: totalSessions?.count || 0,
        pendingActions: pendingCount?.count || 0,
        expiredActions: expiredCount?.count || 0
      },
      availableEndpoints: {
        sessionState: '/api/debug/session-state?sessionId=xxx',
        pendingActions: '/api/debug/session-state?pending=true',
        activeSessions: '/api/debug/session-state?active=true'
      }
    })

  } catch (err) {
    console.error('[Debug Session State] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch session state data', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { sessionId, action, data } = await request.json()

  try {
    switch (action) {
      case 'clear_session':
        // Clear session state
        await clearSessionState(sessionId)
        return NextResponse.json({ success: true, message: 'Session state cleared' })
      
      case 'expire_pending':
        // Expire pending action
        await expirePendingAction(data.actionId)
        return NextResponse.json({ success: true, message: 'Pending action expired' })
      
      case 'force_confirm':
        // Force confirm pending action
        const result = await forceConfirmPendingAction(data.actionId)
        return NextResponse.json({ success: true, result })
      
      case 'create_test_session':
        // Create test session for debugging
        const testSessionId = await createTestSession(data)
        return NextResponse.json({ success: true, sessionId: testSessionId })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Debug Session State] POST Error:', err)
    return NextResponse.json(
      { error: 'Failed to process action', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function clearSessionState(sessionId: string): Promise<void> {
  // Clear session state
  await query(`
    DELETE FROM conversation_session WHERE session_key = $1
  `, [sessionId])
  
  // Clear pending actions
  await query(`
    UPDATE pending_actions SET status = 'cancelled' 
    WHERE session_id = $1 AND status = 'pending'
  `, [sessionId])
}

async function expirePendingAction(actionId: string): Promise<void> {
  await query(`
    UPDATE pending_actions SET status = 'expired' 
    WHERE id = $1 AND status = 'pending'
  `, [actionId])
}

async function forceConfirmPendingAction(actionId: string): Promise<any> {
  // This would execute the pending action and return the result
  // Implementation would depend on the action type
  return { actionId, result: 'forced_confirmation' }
}

async function createTestSession(testData: any): Promise<string> {
  const sessionId = `test_${Date.now()}`
  
  // Create test session
  await query(`
    INSERT INTO conversation_session (session_key, last_domain, last_result, updated_at)
    VALUES ($1, $2, $3, NOW())
  `, [sessionId, testData.domain || 'test', testData.lastResult || {}])
  
  return sessionId
}
