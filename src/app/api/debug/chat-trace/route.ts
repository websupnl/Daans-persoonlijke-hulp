/**
 * Debug API for Chat Trace Analysis
 * 
 * Provides endpoints for debugging and monitoring chat pipeline performance
 */

import { NextRequest, NextResponse } from 'next/server'
import { chatLogger } from '@/lib/chat/logger'
import { correlationTracker } from '@/lib/chat/correlation'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const correlationId = searchParams.get('correlationId')
  const sessionId = searchParams.get('sessionId')
  const errors = searchParams.get('errors')
  const stats = searchParams.get('stats')
  const phase = searchParams.get('phase')
  const hours = searchParams.get('hours')

  try {
    if (correlationId) {
      // Get full trace for specific correlation
      const trace = await chatLogger.getFullTrace(correlationId)
      const correlationLogs = await correlationTracker.getFullTrace(correlationId)
      
      return NextResponse.json({
        correlationId,
        trace: trace.map(log => ({
          ...log,
          data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
        })),
        correlationContext: correlationLogs.map(log => ({
          ...log,
          data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
        }))
      })
    }

    if (sessionId) {
      // Get session logs
      const sessionLogs = await chatLogger.getSessionLogs(sessionId, 50)
      const sessionTrace = await correlationTracker.getSessionTrace(sessionId, 50)
      
      return NextResponse.json({
        sessionId,
        logs: sessionLogs.map(log => ({
          ...log,
          data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
        })),
        trace: sessionTrace.map(log => ({
          ...log,
          data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
        }))
      })
    }

    if (errors) {
      // Get error logs
      const errorLogs = await chatLogger.getErrorLogs(parseInt(errors) || 50)
      
      return NextResponse.json({
        errors: errorLogs.map(log => ({
          ...log,
          data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
        }))
      })
    }

    if (stats) {
      // Get performance stats
      const performanceStats = await chatLogger.getPerformanceStats(
        phase || undefined,
        parseInt(hours || '24') || 24
      )
      
      return NextResponse.json({
        stats: performanceStats,
        phase: phase || 'all',
        hours: parseInt(hours || '24') || 24
      })
    }

    // Default: return recent activity
    const recentErrors = await chatLogger.getErrorLogs(10)
    const globalStats = await chatLogger.getPerformanceStats(undefined, 24)

    return NextResponse.json({
      recentErrors: recentErrors.map(log => ({
        ...log,
        data: typeof log.data === 'string' ? JSON.parse(log.data) : log.data
      })),
      globalStats,
      availableEndpoints: {
        chatTrace: '/api/debug/chat-trace?correlationId=xxx',
        sessionLogs: '/api/debug/chat-trace?sessionId=xxx',
        errorLogs: '/api/debug/chat-trace?errors=50',
        performanceStats: '/api/debug/chat-trace?stats=true&hours=24',
        phaseStats: '/api/debug/chat-trace?stats=true&phase=execution&hours=24'
      }
    })

  } catch (err) {
    console.error('[Debug Chat Trace] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch debug data', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { correlationId, action, data } = await request.json()

  try {
    switch (action) {
      case 'mark_error_resolved':
        // Mark specific error as resolved
        await markErrorResolved(correlationId)
        return NextResponse.json({ success: true, message: 'Error marked as resolved' })
      
      case 'add_debug_note':
        // Add debug note to correlation
        await addDebugNote(correlationId, data.note)
        return NextResponse.json({ success: true, message: 'Debug note added' })
      
      case 'create_test_trace':
        // Create test trace for debugging
        const testCorrelationId = await createTestTrace(data)
        return NextResponse.json({ success: true, correlationId: testCorrelationId })
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Debug Chat Trace] POST Error:', err)
    return NextResponse.json(
      { error: 'Failed to process action', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function markErrorResolved(correlationId: string): Promise<void> {
  // Implementation for marking errors as resolved
  // This would update a separate error tracking table
}

async function addDebugNote(correlationId: string, note: string): Promise<void> {
  // Implementation for adding debug notes
  // This would store notes in a debug notes table
}

async function createTestTrace(testData: any): Promise<string> {
  // Implementation for creating test traces
  // This would generate a test correlation with sample data
  return 'test_' + Date.now()
}
