/**
 * Finance Verification Layer - Read-after-write verification for finance operations
 * 
 * Ensures all finance operations are verified and traceable
 */

import { query, queryOne, execute } from '@/lib/db'
import { chatLogger } from '@/lib/chat/logger'
import { correlationTracker } from '@/lib/chat/correlation'

export interface FinanceQuery {
  period?: 'today' | 'yesterday' | 'week' | 'month' | 'year'
  dateRange?: { start: Date; end: Date }
  category?: string
  type?: 'income' | 'expense' | 'all'
  limit?: number
  offset?: number
}

export interface FinanceTransaction {
  id: number
  title: string
  amount: number
  type: 'income' | 'expense'
  category: string
  subcategory?: string
  account: string
  status: string
  due_date?: string
  created_at: string
  updated_at: string
}

export interface CreateTransactionRequest {
  title: string
  amount: number
  type: 'income' | 'expense'
  category: string
  subcategory?: string
  account?: string
  status?: string
  due_date?: string
  description?: string
}

export interface VerifiedFinanceResult {
  data: FinanceTransaction[]
  totalCount: number
  totalAmount: number
  dataSource: 'database'
  queryTimestamp: Date
  verificationStatus: 'verified'
  queryDetails: {
    period?: string
    dateRange?: { start: string; end: string }
    filters: Record<string, any>
  }
}

export interface VerificationResult {
  verified: boolean
  data: FinanceTransaction
  details: {
    expectedFields: string[]
    actualFields: string[]
    mismatches: string[]
    verificationTime: number
  }
}

export interface WriteVerification {
  success: boolean
  transactionId?: number
  data?: FinanceTransaction
  error?: string
  verificationTime: number
  verificationDetails?: VerificationResult
}

class FinanceVerificationService {
  private static instance: FinanceVerificationService
  
  static getInstance(): FinanceVerificationService {
    if (!FinanceVerificationService.instance) {
      FinanceVerificationService.instance = new FinanceVerificationService()
    }
    return FinanceVerificationService.instance
  }

  async queryFinances(query: FinanceQuery, correlationId: string): Promise<VerifiedFinanceResult> {
    const startTime = Date.now()
    
    try {
      // 1. Parse and validate query
      const validatedQuery = this.validateQuery(query)
      
      // 2. Build SQL query with explicit date resolution
      const { sql, params } = this.buildQuery(validatedQuery)
      
      // 3. Execute query
      const transactions = await this.executeQuery(sql, params)
      
      // 4. Verify data integrity
      const verified = await this.verifyQueryResult(transactions, validatedQuery)
      
      // 5. Calculate aggregates
      const totalCount = transactions.length
      const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)
      
      const result: VerifiedFinanceResult = {
        data: verified,
        totalCount,
        totalAmount,
        dataSource: 'database',
        queryTimestamp: new Date(),
        verificationStatus: 'verified',
        queryDetails: {
          period: validatedQuery.period,
          dateRange: validatedQuery.dateRange ? {
            start: validatedQuery.dateRange.start.toISOString(),
            end: validatedQuery.dateRange.end.toISOString()
          } : undefined,
          filters: {
            category: validatedQuery.category,
            type: validatedQuery.type,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset
          }
        }
      }

      await chatLogger.logVerification(
        { correlationId, sessionId: 'unknown', channel: 'unknown' },
        {
          verified: true,
          verificationDetails: { query, result },
          writeResults: [],
          success: true
        }
      )

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      await chatLogger.logError(
        { correlationId, sessionId: 'unknown', channel: 'unknown' },
        'verification',
        err as Error,
        { query }
      )
      
      throw new Error(`Finance query verification failed: ${error}`)
    }
  }

  async createTransaction(
    transaction: CreateTransactionRequest,
    correlationId: string
  ): Promise<WriteVerification> {
    const startTime = Date.now()
    
    try {
      // 1. Validate input
      const validated = this.validateTransactionInput(transaction)
      
      // 2. Execute write
      const writeResult = await this.executeWrite(validated)
      
      if (!writeResult.id) {
        return {
          success: false,
          error: 'Write failed - no ID returned',
          verificationTime: Date.now() - startTime
        }
      }
      
      // 3. Read-after-write verification
      const verification = await this.verifyWrite(writeResult.id, validated)
      
      const result: WriteVerification = {
        success: verification.verified,
        transactionId: writeResult.id,
        data: verification.verified ? verification.data : undefined,
        error: verification.verified ? undefined : 'Write verification failed',
        verificationTime: Date.now() - startTime,
        verificationDetails: verification
      }

      await correlationTracker.trackWrite(correlationId, {
        success: result.success,
        data: result.data,
        error: result.error,
        writeId: writeResult.id.toString()
      })

      await chatLogger.logVerification(
        { correlationId, sessionId: 'unknown', channel: 'unknown' },
        {
          verified: result.success,
          verificationDetails: result.verificationDetails,
          writeResults: [result],
          success: result.success
        }
      )

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      
      await correlationTracker.trackWrite(correlationId, {
        success: false,
        error,
        writeId: undefined
      })

      return {
        success: false,
        error,
        verificationTime: Date.now() - startTime
      }
    }
  }

  private validateQuery(query: FinanceQuery): FinanceQuery {
    const validated: FinanceQuery = { ...query }

    // Explicit date resolution
    if (query.period) {
      const dateRange = this.resolveDateRange(query.period)
      validated.dateRange = dateRange
    }

    // Validate limits
    if (query.limit && (query.limit < 1 || query.limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000')
    }

    if (query.offset && query.offset < 0) {
      throw new Error('Offset must be non-negative')
    }

    // Validate type
    if (query.type && !['income', 'expense', 'all'].includes(query.type)) {
      throw new Error('Type must be income, expense, or all')
    }

    return validated
  }

  private resolveDateRange(period: string): { start: Date; end: Date } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    switch (period) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        }
      
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
        return {
          start: yesterday,
          end: today
        }
      
      case 'week':
        const weekStart = new Date(today.getTime() - (today.getDay() || 7) * 24 * 60 * 60 * 1000)
        return {
          start: weekStart,
          end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        return {
          start: monthStart,
          end: new Date(today.getFullYear(), today.getMonth() + 1, 1)
        }
      
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1)
        return {
          start: yearStart,
          end: new Date(today.getFullYear() + 1, 0, 1)
        }
      
      default:
        throw new Error(`Unsupported period: ${period}`)
    }
  }

  private buildQuery(query: FinanceQuery): { sql: string; params: any[] } {
    let sql = `
      SELECT id, title, amount::float, type, category, subcategory, 
             account, status, due_date, created_at, updated_at
      FROM finance_items
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    // Date range filter
    if (query.dateRange) {
      sql += ` AND DATE(created_at) >= DATE($${paramIndex})`
      params.push(query.dateRange.start)
      paramIndex++
      
      sql += ` AND DATE(created_at) <= DATE($${paramIndex})`
      params.push(query.dateRange.end)
      paramIndex++
    }

    // Type filter
    if (query.type && query.type !== 'all') {
      sql += ` AND type = $${paramIndex}`
      params.push(query.type)
      paramIndex++
    }

    // Category filter
    if (query.category) {
      sql += ` AND category = $${paramIndex}`
      params.push(query.category)
      paramIndex++
    }

    // Order and limit
    sql += ` ORDER BY created_at DESC`
    
    if (query.limit) {
      sql += ` LIMIT $${paramIndex}`
      params.push(query.limit)
      paramIndex++
      
      if (query.offset) {
        sql += ` OFFSET $${paramIndex}`
        params.push(query.offset)
      }
    }

    return { sql, params }
  }

  private async executeQuery(sql: string, params: any[]): Promise<FinanceTransaction[]> {
    const results = await query<any>(sql, params)
    
    return results.map(row => ({
      id: row.id,
      title: row.title,
      amount: parseFloat(row.amount),
      type: row.type,
      category: row.category,
      subcategory: row.subcategory,
      account: row.account,
      status: row.status,
      due_date: row.due_date,
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  }

  private async verifyQueryResult(transactions: FinanceTransaction[], query: FinanceQuery): Promise<FinanceTransaction[]> {
    // Verify all required fields are present
    const requiredFields = ['id', 'title', 'amount', 'type', 'category', 'created_at']
    
    for (const transaction of transactions) {
      for (const field of requiredFields) {
        if (!(field in transaction) || transaction[field as keyof FinanceTransaction] === undefined) {
          throw new Error(`Transaction missing required field: ${field}`)
        }
      }
      
      // Verify amount is valid number
      if (isNaN(transaction.amount) || transaction.amount < 0) {
        throw new Error(`Invalid amount: ${transaction.amount}`)
      }
      
      // Verify type is valid
      if (!['income', 'expense'].includes(transaction.type)) {
        throw new Error(`Invalid type: ${transaction.type}`)
      }
    }

    return transactions
  }

  private validateTransactionInput(transaction: CreateTransactionRequest): CreateTransactionRequest {
    // Required fields
    if (!transaction.title || transaction.title.trim() === '') {
      throw new Error('Title is required')
    }
    
    if (!transaction.amount || isNaN(transaction.amount) || transaction.amount <= 0) {
      throw new Error('Amount must be a positive number')
    }
    
    if (!transaction.type || !['income', 'expense'].includes(transaction.type)) {
      throw new Error('Type must be income or expense')
    }
    
    if (!transaction.category || transaction.category.trim() === '') {
      throw new Error('Category is required')
    }

    // Default values
    const validated: CreateTransactionRequest = {
      title: transaction.title.trim(),
      amount: parseFloat(transaction.amount.toString()),
      type: transaction.type,
      category: transaction.category.trim(),
      subcategory: transaction.subcategory?.trim() || undefined,
      account: transaction.account || 'privé',
      status: transaction.status || 'betaald',
      due_date: transaction.due_date || undefined,
      description: transaction.description?.trim() || undefined
    }

    return validated
  }

  private async executeWrite(transaction: CreateTransactionRequest): Promise<{ id: number }> {
    const sql = `
      INSERT INTO finance_items (
        title, amount, type, category, subcategory, account, status, 
        due_date, description, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id
    `
    
    const params = [
      transaction.title,
      transaction.amount,
      transaction.type,
      transaction.category,
      transaction.subcategory,
      transaction.account,
      transaction.status,
      transaction.due_date,
      transaction.description
    ]
    
    const result = await queryOne<{ id: number }>(sql, params)
    
    if (!result || !result.id) {
      throw new Error('Failed to create transaction - no ID returned')
    }
    
    return result
  }

  private async verifyWrite(id: number, expected: CreateTransactionRequest): Promise<VerificationResult> {
    const startTime = Date.now()
    
    try {
      const actual = await queryOne<any>(`
        SELECT id, title, amount::float, type, category, subcategory, 
               account, status, due_date, description, created_at, updated_at
        FROM finance_items
        WHERE id = $1
      `, [id])
      
      if (!actual) {
        return {
          verified: false,
          data: {} as FinanceTransaction,
          details: {
            expectedFields: Object.keys(expected),
            actualFields: [],
            mismatches: ['Transaction not found in database'],
            verificationTime: Date.now() - startTime
          }
        }
      }

      const expectedFields = Object.keys(expected)
      const actualFields = ['id', 'title', 'amount', 'type', 'category', 'subcategory', 'account', 'status', 'due_date', 'description']
      const mismatches: string[] = []

      // Compare critical fields
      if (actual.title !== expected.title) {
        mismatches.push(`Title mismatch: expected "${expected.title}", got "${actual.title}"`)
      }
      
      if (parseFloat(actual.amount) !== expected.amount) {
        mismatches.push(`Amount mismatch: expected ${expected.amount}, got ${actual.amount}`)
      }
      
      if (actual.type !== expected.type) {
        mismatches.push(`Type mismatch: expected "${expected.type}", got "${actual.type}"`)
      }
      
      if (actual.category !== expected.category) {
        mismatches.push(`Category mismatch: expected "${expected.category}", got "${actual.category}"`)
      }

      const verified = mismatches.length === 0

      return {
        verified,
        data: {
          id: actual.id,
          title: actual.title,
          amount: parseFloat(actual.amount),
          type: actual.type,
          category: actual.category,
          subcategory: actual.subcategory,
          account: actual.account,
          status: actual.status,
          due_date: actual.due_date,
          created_at: actual.created_at,
          updated_at: actual.updated_at
        },
        details: {
          expectedFields,
          actualFields,
          mismatches,
          verificationTime: Date.now() - startTime
        }
      }
    } catch (err) {
      return {
        verified: false,
        data: {} as FinanceTransaction,
        details: {
          expectedFields: Object.keys(expected),
          actualFields: [],
          mismatches: [`Verification error: ${err instanceof Error ? err.message : 'Unknown error'}`],
          verificationTime: Date.now() - startTime
        }
      }
    }
  }

  async getVerificationStats(): Promise<{
    totalQueries: number
    verifiedQueries: number
    totalWrites: number
    verifiedWrites: number
    averageVerificationTime: number
  }> {
    // This would query verification statistics from logs
    // For now, return placeholder data
    return {
      totalQueries: 0,
      verifiedQueries: 0,
      totalWrites: 0,
      verifiedWrites: 0,
      averageVerificationTime: 0
    }
  }
}

export const financeVerificationService = FinanceVerificationService.getInstance()
