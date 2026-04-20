import { query, queryOne, execute } from '../db'

export interface Tenant {
  id: string
  name: string
  database_url: string
  telegram_bot_token: string
  telegram_bot_username: string
  is_active: boolean
  created_at: string
}

export interface User {
  id: string
  tenant_id: string
  telegram_user_id?: string
  email?: string
  name: string
  is_active: boolean
  created_at: string
}

export class TenantManager {
  private static instance: TenantManager
  private tenantCache: Map<string, Tenant> = new Map()
  private userCache: Map<string, User> = new Map()

  static getInstance(): TenantManager {
    if (!TenantManager.instance) {
      TenantManager.instance = new TenantManager()
    }
    return TenantManager.instance
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    if (this.tenantCache.has(tenantId)) {
      return this.tenantCache.get(tenantId)!
    }

    const tenant = await queryOne<Tenant>(`
      SELECT id, name, database_url, telegram_bot_token, telegram_bot_username, is_active, created_at
      FROM tenants 
      WHERE id = $1 AND is_active = true
    `, [tenantId])

    if (tenant) {
      this.tenantCache.set(tenantId, tenant)
    }

    return tenant ?? null
  }

  /**
   * Get tenant by Telegram user ID
   */
  async getTenantByTelegramUserId(telegramUserId: string): Promise<Tenant | null> {
    const user = await this.getUserByTelegramUserId(telegramUserId)
    if (!user) return null

    return this.getTenant(user.tenant_id)
  }

  /**
   * Get user by Telegram user ID
   */
  async getUserByTelegramUserId(telegramUserId: string): Promise<User | null> {
    const cacheKey = `telegram:${telegramUserId}`
    if (this.userCache.has(cacheKey)) {
      return this.userCache.get(cacheKey)!
    }

    const user = await queryOne<User>(`
      SELECT id, tenant_id, telegram_user_id, email, name, is_active, created_at
      FROM users 
      WHERE telegram_user_id = $1 AND is_active = true
    `, [telegramUserId])

    if (user) {
      this.userCache.set(cacheKey, user)
    }

    return user ?? null
  }

  /**
   * Create new tenant
   */
  async createTenant(tenantData: {
    name: string
    database_url: string
    telegram_bot_token: string
    telegram_bot_username: string
  }): Promise<Tenant> {
    const tenantId = tenantData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    
    const tenant = await queryOne<Tenant>(`
      INSERT INTO tenants (id, name, database_url, telegram_bot_token, telegram_bot_username, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, name, database_url, telegram_bot_token, telegram_bot_username, is_active, created_at
    `, [tenantId, tenantData.name, tenantData.database_url, tenantData.telegram_bot_token, tenantData.telegram_bot_username])

    if (!tenant) {
      throw new Error('Failed to create tenant')
    }

    this.tenantCache.set(tenantId, tenant)
    return tenant
  }

  /**
   * Create new user for tenant
   */
  async createUser(userData: {
    tenant_id: string
    telegram_user_id?: string
    email?: string
    name: string
  }): Promise<User> {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const user = await queryOne<User>(`
      INSERT INTO users (id, tenant_id, telegram_user_id, email, name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id, tenant_id, telegram_user_id, email, name, is_active, created_at
    `, [userId, userData.tenant_id, userData.telegram_user_id, userData.email, userData.name])

    if (!user) {
      throw new Error('Failed to create user')
    }

    this.userCache.set(`telegram:${userData.telegram_user_id}`, user)
    return user
  }

  /**
   * Get all active tenants
   */
  async getAllTenants(): Promise<Tenant[]> {
    return await query<Tenant>(`
      SELECT id, name, database_url, telegram_bot_token, telegram_bot_username, is_active, created_at
      FROM tenants 
      WHERE is_active = true
      ORDER BY created_at
    `)
  }

  /**
   * Clear cache for tenant
   */
  clearTenantCache(tenantId: string): void {
    this.tenantCache.delete(tenantId)
  }

  /**
   * Clear cache for user
   */
  clearUserCache(userId: string): void {
    this.userCache.delete(userId)
  }
}
