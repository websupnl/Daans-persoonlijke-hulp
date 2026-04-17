export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { correlationTracker } from '@/lib/chat/correlation'
import { chatLogger } from '@/lib/chat/logger'
import { truthfulnessGuard } from '@/lib/chat/truthfulness'
import { pendingActionManager } from '@/lib/chat/pending-actions'
import { confirmationManager } from '@/lib/chat/confirmation'
import { financeVerificationService } from '@/lib/finance/verification'
import { unifiedSessionManager } from '@/lib/chat/unified-session'

export async function GET(request: NextRequest) {
  const testResults: Record<string, any> = {}

  try {
    // Test 1: Correlation Tracking
    const correlationId = await correlationTracker.trackMessage({
      sessionId: 'test_session',
      channel: 'test',
      content: 'test message'
    })
    testResults.correlationTracking = {
      success: !!correlationId,
      correlationId,
      message: 'Correlation tracking working'
    }

    // Test 2: Chat Logger
    await chatLogger.logIntake({
      correlationId: correlationId || 'test',
      sessionId: 'test_session',
      channel: 'test',
      userId: 'test_user'
    }, 'test message')
    testResults.chatLogger = {
      success: true,
      message: 'Chat logger working'
    }

    // Test 3: Truthfulness Guard
    const validationResult = await truthfulnessGuard.validateResponse({
      reply: 'Test response',
      claimsSuccess: false,
      dataSource: 'database'
    }, {
      correlationId: correlationId || 'test',
      sessionId: 'test_session',
      phase: 'response',
      dataSource: 'database'
    })
    testResults.truthfulnessGuard = {
      success: validationResult.valid,
      validationResult,
      message: validationResult.valid ? 'Truthfulness guard working' : 'Truthfulness guard found issues'
    }

    // Test 4: Pending Action Manager
    const pendingActionId = await pendingActionManager.createPendingAction(
      'test_session',
      { type: 'todo_create', payload: { title: 'Test todo' } },
      correlationId || 'test',
      { confirmationPrompt: 'Test confirmation' }
    )
    testResults.pendingActionManager = {
      success: !!pendingActionId,
      pendingActionId,
      message: 'Pending action manager working'
    }

    // Test 5: Confirmation Manager
    const confirmationResult = await confirmationManager.handleResponse(
      'test_session',
      'no',
      correlationId || 'test'
    )
    testResults.confirmationManager = {
      success: true,
      confirmationResult,
      message: 'Confirmation manager working'
    }

    // Test 6: Finance Verification (read-only test)
    try {
      const financeResult = await financeVerificationService.queryFinances(
        { period: 'today', type: 'all' },
        correlationId || 'test'
      )
      testResults.financeVerification = {
        success: true,
        verificationStatus: financeResult.verificationStatus,
        dataSource: financeResult.dataSource,
        message: 'Finance verification working'
      }
    } catch (err) {
      testResults.financeVerification = {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        message: 'Finance verification failed'
      }
    }

    // Test 7: Unified Session Manager
    const session = await unifiedSessionManager.getOrCreateSession(
      'test_user',
      'test_channel',
      { test: true }
    )
    testResults.unifiedSessionManager = {
      success: !!session,
      sessionId: session?.sessionId,
      message: 'Unified session manager working'
    }

    // Test 8: Overall Architecture Status
    const allTestsPassed = Object.values(testResults).every(result => result.success)
    
    return NextResponse.json({
      overall: {
        success: allTestsPassed,
        message: allTestsPassed ? 'All architecture components working!' : 'Some components have issues',
        timestamp: new Date().toISOString()
      },
      components: testResults,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL,
        deployed: true
      }
    })

  } catch (err) {
    return NextResponse.json({
      overall: {
        success: false,
        message: 'Architecture test failed',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      components: testResults
    }, { status: 500 })
  }
}
