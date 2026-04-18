import { headers } from 'next/headers'
import { TenantManager } from './TenantManager'
import { DatabaseRouter } from './DatabaseRouter'
import { User } from './TenantManager'

export interface TenantContext {
  tenant: any
  user: User | null
  database: DatabaseRouter
}

export class TenantContextManager {
  private static instance: TenantContextManager
  private tenantManager: TenantManager
  private databaseRouter: DatabaseRouter

  constructor() {
    this.tenantManager = TenantManager.getInstance()
    this.databaseRouter = DatabaseRouter.getInstance()
  }

  static getInstance(): TenantContextManager {
    if (!TenantContextManager.instance) {
      TenantContextManager.instance = new TenantContextManager()
    }
    return TenantContextManager.instance
  }

  /**
   * Get tenant context from request headers
   */
  async getContextFromHeaders(): Promise<TenantContext | null> {
    const headersList = headers()
    const tenantId = headersList.get('x-tenant-id')
    const telegramUserId = headersList.get('x-telegram-user-id')

    if (!tenantId && !telegramUserId) {
      return null
    }

    let tenant: any
    let user: User | null = null

    if (telegramUserId) {
      // Get tenant by Telegram user ID
      tenant = await this.tenantManager.getTenantByTelegramUserId(telegramUserId)
      user = await this.tenantManager.getUserByTelegramUserId(telegramUserId)
    } else if (tenantId) {
      // Get tenant by ID
      tenant = await this.tenantManager.getTenant(tenantId)
    }

    if (!tenant) {
      return null
    }

    return {
      tenant,
      user,
      database: this.databaseRouter
    }
  }

  /**
   * Get tenant context from Telegram update
   */
  async getContextFromTelegramUpdate(update: any): Promise<TenantContext | null> {
    const telegramUserId = update.message?.from?.id || update.callback_query?.from?.id

    if (!telegramUserId) {
      return null
    }

    const tenant = await this.tenantManager.getTenantByTelegramUserId(telegramUserId.toString())
    const user = await this.tenantManager.getUserByTelegramUserId(telegramUserId.toString())

    if (!tenant) {
      return null
    }

    return {
      tenant,
      user,
      database: this.databaseRouter
    }
  }

  /**
   * Create tenant context for new user registration
   */
  async createContextForNewUser(userData: {
    tenant_id: string
    telegram_user_id?: string
    email?: string
    name: string
  }): Promise<TenantContext> {
    const tenant = await this.tenantManager.getTenant(userData.tenant_id)
    if (!tenant) {
      throw new Error(`Tenant ${userData.tenant_id} not found`)
    }

    let user: User | null = null
    if (userData.telegram_user_id) {
      user = await this.tenantManager.getUserByTelegramUserId(userData.telegram_user_id)
      if (!user) {
        user = await this.tenantManager.createUser(userData)
      }
    }

    return {
      tenant,
      user,
      database: this.databaseRouter
    }
  }

  /**
   * Middleware to add tenant context to request
   */
  async middleware(request: Request): Promise<{ request: Request; context: TenantContext | null }> {
    const context = await this.getContextFromHeaders()
    
    // Add context to request headers for downstream use
    if (context) {
      request.headers.set('x-tenant-context', JSON.stringify({
        tenant_id: context.tenant.id,
        user_id: context.user?.id
      }))
    }

    return { request, context }
  }

  /**
   * Validate tenant access
   */
  async validateTenantAccess(tenantId: string, userId: string): Promise<boolean> {
    const user = await this.tenantManager.getUserByTelegramUserId(userId)
    if (!user) {
      return false
    }

    return user.tenant_id === tenantId
  }

  /**
   * Get tenant-specific database helpers
   */
  getTenantDatabaseHelpers(context: TenantContext) {
    return {
      query: <T = any>(sql: string, params?: any[]) => 
        context.database.query<T>(context.tenant.id, sql, params),
      
      queryOne: <T = any>(sql: string, params?: any[]) => 
        context.database.queryOne<T>(context.tenant.id, sql, params),
      
      execute: (sql: string, params?: any[]) => 
        context.database.execute(context.tenant.id, sql, params)
    }
  }
}
