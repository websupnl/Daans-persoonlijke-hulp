/**
 * Confirmation Flow Tests
 * 
 * Tests for robust confirmation handling across scenarios
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { pendingActionManager } from '@/lib/chat/pending-actions'
import { confirmationManager } from '@/lib/chat/confirmation'
import { chatLogger } from '@/lib/chat/logger'
import { correlationTracker } from '@/lib/chat/correlation'

describe('Confirmation Flow', () => {
  const testSessionId = 'test_session_123'
  const testCorrelationId = 'test_corr_123'
  const testUserId = 'test_user_123'

  beforeAll(async () => {
    // Setup test environment
    await cleanupTestData()
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  test('reminder confirmation yes', async () => {
    // 1. Create pending action for reminder
    const actionId = await pendingActionManager.createPendingAction(
      testSessionId,
      {
        type: 'reminder_create',
        payload: {
          title: 'Test reminder',
          reminder_time: '2026-04-19T10:00:00Z'
        }
      },
      testCorrelationId,
      {
        confirmationPrompt: 'Wil je dat ik een herinnering instel om hier later op terug te komen?',
        expiresMinutes: 5
      }
    )

    expect(actionId).toBeDefined()

    // 2. Send confirmation "Ja"
    const confirmationResult = await confirmationManager.handleResponse(
      testSessionId,
      'Ja',
      testCorrelationId
    )

    expect(confirmationResult.success).toBe(true)
    expect(confirmationResult.confirmed).toBe(true)
    expect(confirmationResult.actionId).toBe(actionId)

    // 3. Verify in database (mock verification)
    const pendingAction = await pendingActionManager.getPendingAction(testSessionId)
    expect(pendingAction).toBeNull() // Should be completed
  })

  test('reminder confirmation no pending action', async () => {
    // Send "Ja" without pending action
    const confirmationResult = await confirmationManager.handleResponse(
      testSessionId + '_new',
      'Ja',
      testCorrelationId + '_new'
    )

    expect(confirmationResult.success).toBe(false)
    expect(confirmationResult.confirmed).toBe(false)
    expect(confirmationResult.error).toContain('No pending action found')
  })

  test('reminder confirmation cancel', async () => {
    // 1. Create pending action
    const actionId = await pendingActionManager.createPendingAction(
      testSessionId + '_cancel',
      {
        type: 'reminder_create',
        payload: {
          title: 'Test reminder to cancel',
          reminder_time: '2026-04-19T10:00:00Z'
        }
      },
      testCorrelationId + '_cancel',
      {
        confirmationPrompt: 'Wil je dat ik een herinnering instel?',
        expiresMinutes: 5
      }
    )

    // 2. Send cancellation
    const confirmationResult = await confirmationManager.handleResponse(
      testSessionId + '_cancel',
      'Nee, annuleer',
      testCorrelationId + '_cancel'
    )

    expect(confirmationResult.success).toBe(true)
    expect(confirmationResult.confirmed).toBe(false)
    expect(confirmationResult.actionId).toBe(actionId)
  })

  test('reminder confirmation expired', async () => {
    // 1. Create expired pending action
    const actionId = await pendingActionManager.createPendingAction(
      testSessionId + '_expired',
      {
        type: 'reminder_create',
        payload: {
          title: 'Expired reminder',
          reminder_time: '2026-04-19T10:00:00Z'
        }
      },
      testCorrelationId + '_expired',
      {
        confirmationPrompt: 'Wil je dat ik een herinnering instel?',
        expiresMinutes: 0.01 // Very short expiration
      }
    )

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 100))

    // 2. Try to confirm expired action
    const confirmationResult = await confirmationManager.handleResponse(
      testSessionId + '_expired',
      'Ja',
      testCorrelationId + '_expired'
    )

    expect(confirmationResult.success).toBe(false)
    expect(confirmationResult.error).toContain('expired')
  })

  test('confirmation with invalid input', async () => {
    // 1. Create pending action
    await pendingActionManager.createPendingAction(
      testSessionId + '_invalid',
      {
        type: 'reminder_create',
        payload: {
          title: 'Test reminder',
          reminder_time: '2026-04-19T10:00:00Z'
        }
      },
      testCorrelationId + '_invalid',
      {
        confirmationPrompt: 'Wil je dat ik een herinnering instel?',
        expiresMinutes: 5
      }
    )

    // 2. Send invalid response
    const confirmationResult = await confirmationManager.handleResponse(
      testSessionId + '_invalid',
      'maybe',
      testCorrelationId + '_invalid'
    )

    expect(confirmationResult.success).toBe(false)
    expect(confirmationResult.confirmed).toBe(false)
    expect(confirmationResult.error).toBeDefined()
  })

  test('multi-step confirmation flow', async () => {
    const steps = [
      {
        id: 'step1',
        type: 'input' as const,
        prompt: 'Wat is de titel van je herinnering?',
        expectedInput: { type: 'text' as const }
      },
      {
        id: 'step2',
        type: 'confirmation' as const,
        prompt: 'Wil je dat ik deze herinnering instel?',
        expectedInput: { type: 'yes_no_cancel' as const }
      }
    ]

    // 1. Create multi-step flow
    const flowId = await confirmationManager.createMultiStepConfirmation(
      testSessionId + '_multi',
      steps,
      testCorrelationId + '_multi'
    )

    expect(flowId).toBeDefined()

    // 2. Handle first step input
    const step1Result = await confirmationManager.handleMultiStepResponse(
      testSessionId + '_multi',
      'Test herinnering titel',
      testCorrelationId + '_multi'
    )

    expect(step1Result.success).toBe(true)
    expect(step1Result.completed).toBe(false)
    expect(step1Result.currentStep).toBe(1)
    expect(step1Result.nextPrompt).toBe('Wil je dat ik deze herinnering instel?')

    // 3. Handle confirmation
    const step2Result = await confirmationManager.handleMultiStepResponse(
      testSessionId + '_multi',
      'Ja',
      testCorrelationId + '_multi'
    )

    expect(step2Result.success).toBe(true)
    expect(step2Result.completed).toBe(true)
    expect(step2Result.results).toBeDefined()
    expect(step2Result.results).toHaveLength(2)
  })
})

// Helper function to clean up test data
async function cleanupTestData(): Promise<void> {
  // Implementation would clean up test data from database
  // For now, this is a placeholder
  console.log('Cleaning up test data...')
}
