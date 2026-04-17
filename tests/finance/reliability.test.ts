/**
 * Finance Reliability Tests
 * 
 * Tests for read-after-write verification and data integrity
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { financeVerificationService } from '@/lib/finance/verification'
import { chatLogger } from '@/lib/chat/logger'
import { correlationTracker } from '@/lib/chat/correlation'

describe('Finance Reliability', () => {
  const testCorrelationId = 'test_finance_corr_123'

  beforeAll(async () => {
    // Setup test environment
    await cleanupTestData()
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
  })

  test('yesterday expense query', async () => {
    // 1. Add test expense (mock)
    const testTransaction = {
      title: 'Test uitgave',
      amount: 50,
      type: 'expense' as const,
      category: 'test',
      account: 'test',
      status: 'betaald'
    }

    // Mock database insert for testing
    await mockDatabaseInsert(testTransaction)

    // 2. Query yesterday expenses
    const queryResult = await financeVerificationService.queryFinances(
      {
        period: 'yesterday',
        type: 'expense'
      },
      testCorrelationId
    )

    expect(queryResult.verificationStatus).toBe('verified')
    expect(queryResult.dataSource).toBe('database')
    expect(queryResult.dataVerified).toBeUndefined() // Should be verified by default
    expect(queryResult.queryDetails.period).toBe('yesterday')
  })

  test('expense write verification', async () => {
    // 1. Create expense
    const createRequest = {
      title: 'Test uitgave verificatie',
      amount: 25,
      type: 'expense' as const,
      category: 'test',
      account: 'test'
    }

    const writeResult = await financeVerificationService.createTransaction(
      createRequest,
      testCorrelationId + '_write'
    )

    expect(writeResult.success).toBe(true)
    expect(writeResult.transactionId).toBeDefined()
    expect(writeResult.verificationDetails).toBeDefined()
    expect(writeResult.verificationDetails?.verified).toBe(true)

    // 2. Verify in database (mock verification)
    const verification = writeResult.verificationDetails
    expect(verification?.data.title).toBe(createRequest.title)
    expect(verification?.data.amount).toBe(createRequest.amount)
  })

  test('expense write failure handling', async () => {
    // 1. Try to create invalid expense
    const invalidRequest = {
      title: '', // Invalid: empty title
      amount: -10, // Invalid: negative amount
      type: 'invalid' as any, // Invalid: wrong type
      category: 'test'
    }

    const writeResult = await financeVerificationService.createTransaction(
      invalidRequest,
      testCorrelationId + '_invalid'
    )

    expect(writeResult.success).toBe(false)
    expect(writeResult.error).toBeDefined()
    expect(writeResult.transactionId).toBeUndefined()
  })

  test('date resolution accuracy', async () => {
    // Test different date periods
    const periods = ['today', 'yesterday', 'week', 'month'] as const

    for (const period of periods) {
      const queryResult = await financeVerificationService.queryFinances(
        { period },
        testCorrelationId + '_' + period
      )

      expect(queryResult.verificationStatus).toBe('verified')
      expect(queryResult.queryDetails.period).toBe(period)
      
      if (queryResult.queryDetails.dateRange) {
        const { start, end } = queryResult.queryDetails.dateRange
        expect(new Date(start)).toBeInstanceOf(Date)
        expect(new Date(end)).toBeInstanceOf(Date)
        expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime())
      }
    }
  })

  test('query validation', async () => {
    // Test invalid queries
    const invalidQueries = [
      { period: 'invalid_period' as any },
      { limit: -1 },
      { limit: 1001 }, // Over limit
      { offset: -1 },
      { type: 'invalid_type' as any }
    ]

    for (const query of invalidQueries) {
      await expect(
        financeVerificationService.queryFinances(query, testCorrelationId + '_invalid')
      ).rejects.toThrow()
    }
  })

  test('transaction validation', async () => {
    // Test invalid transaction inputs
    const invalidTransactions = [
      {
        title: '',
        amount: 10,
        type: 'expense' as const,
        category: 'test'
      },
      {
        title: 'Valid title',
        amount: 0, // Invalid: zero amount
        type: 'expense' as const,
        category: 'test'
      },
      {
        title: 'Valid title',
        amount: 10,
        type: 'invalid' as any, // Invalid type
        category: 'test'
      },
      {
        title: 'Valid title',
        amount: 10,
        type: 'expense' as const,
        category: '' // Invalid: empty category
      }
    ]

    for (const transaction of invalidTransactions) {
      const result = await financeVerificationService.createTransaction(
        transaction,
        testCorrelationId + '_validation'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    }
  })

  test('concurrent write verification', async () => {
    // Test multiple concurrent writes
    const transactions = Array.from({ length: 5 }, (_, i) => ({
      title: `Concurrent transaction ${i}`,
      amount: 10 + i,
      type: 'expense' as const,
      category: 'concurrent_test'
    }))

    const results = await Promise.all(
      transactions.map((tx, i) =>
        financeVerificationService.createTransaction(tx, testCorrelationId + `_concurrent_${i}`)
      )
    )

    // All should succeed
    results.forEach((result, i) => {
      expect(result.success).toBe(true)
      expect(result.transactionId).toBeDefined()
      expect(result.verificationDetails?.verified).toBe(true)
      expect(result.verificationDetails?.data.title).toBe(transactions[i].title)
    })
  })

  test('data integrity verification', async () => {
    // 1. Create transaction with all fields
    const fullTransaction = {
      title: 'Complete transaction',
      amount: 100,
      type: 'expense' as const,
      category: 'complete',
      subcategory: 'test_subcategory',
      account: 'test_account',
      status: 'betaald',
      due_date: '2026-04-19',
      description: 'Test description'
    }

    const writeResult = await financeVerificationService.createTransaction(
      fullTransaction,
      testCorrelationId + '_complete'
    )

    expect(writeResult.success).toBe(true)

    // 2. Verify all fields are preserved
    const verification = writeResult.verificationDetails
    expect(verification?.data.title).toBe(fullTransaction.title)
    expect(verification?.data.amount).toBe(fullTransaction.amount)
    expect(verification?.data.type).toBe(fullTransaction.type)
    expect(verification?.data.category).toBe(fullTransaction.category)
    expect(verification?.data.subcategory).toBe(fullTransaction.subcategory)
    expect(verification?.data.account).toBe(fullTransaction.account)
    expect(verification?.data.status).toBe(fullTransaction.status)
    expect(verification?.data.due_date).toBe(fullTransaction.due_date)
    expect(verification?.data.description).toBe(fullTransaction.description)
  })
})

// Helper functions for testing
async function cleanupTestData(): Promise<void> {
  // Implementation would clean up test data from database
  console.log('Cleaning up finance test data...')
}

async function mockDatabaseInsert(transaction: any): Promise<void> {
  // Mock database insert for testing
  // In real implementation, this would insert into actual database
  console.log('Mock inserting transaction:', transaction)
}
