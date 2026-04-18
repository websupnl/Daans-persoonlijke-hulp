import { Pool } from 'pg'
import { TenantManager, Tenant } from './TenantManager'

export class DatabaseRouter {
  private static instance: DatabaseRouter
  private connections: Map<string, Pool> = new Map()
  private tenantManager: TenantManager

  constructor() {
    this.tenantManager = TenantManager.getInstance()
  }

  static getInstance(): DatabaseRouter {
    if (!DatabaseRouter.instance) {
      DatabaseRouter.instance = new DatabaseRouter()
    }
    return DatabaseRouter.instance
  }

  /**
   * Get database connection for tenant
   */
  async getConnection(tenantId: string): Promise<Pool> {
    if (this.connections.has(tenantId)) {
      return this.connections.get(tenantId)!
    }

    const tenant = await this.tenantManager.getTenant(tenantId)
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`)
    }

    const pool = new Pool({
      connectionString: tenant.database_url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    // Test connection
    try {
      await pool.query('SELECT 1')
      this.connections.set(tenantId, pool)
      return pool
    } catch (error) {
      console.error(`Failed to connect to tenant ${tenantId} database:`, error)
      throw new Error(`Database connection failed for tenant ${tenantId}`)
    }
  }

  /**
   * Get connection by Telegram user ID
   */
  async getConnectionByTelegramUserId(telegramUserId: string): Promise<Pool> {
    const tenant = await this.tenantManager.getTenantByTelegramUserId(telegramUserId)
    if (!tenant) {
      throw new Error(`No tenant found for Telegram user ${telegramUserId}`)
    }

    return this.getConnection(tenant.id)
  }

  /**
   * Execute query on tenant database
   */
  async query<T = any>(tenantId: string, sql: string, params?: any[]): Promise<T[]> {
    const pool = await this.getConnection(tenantId)
    const result = await pool.query(sql, params)
    return result.rows
  }

  /**
   * Execute single row query on tenant database
   */
  async queryOne<T = any>(tenantId: string, sql: string, params?: any[]): Promise<T | null> {
    const pool = await this.getConnection(tenantId)
    const result = await pool.query(sql, params)
    return result.rows[0] || null
  }

  /**
   * Execute non-query on tenant database
   */
  async execute(tenantId: string, sql: string, params?: any[]): Promise<void> {
    const pool = await this.getConnection(tenantId)
    await pool.query(sql, params)
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(pool => pool.end())
    await Promise.all(closePromises)
    this.connections.clear()
  }

  /**
   * Close connection for specific tenant
   */
  async closeConnection(tenantId: string): Promise<void> {
    const pool = this.connections.get(tenantId)
    if (pool) {
      await pool.end()
      this.connections.delete(tenantId)
    }
  }

  /**
   * Test connection for tenant
   */
  async testConnection(tenantId: string): Promise<boolean> {
    try {
      const pool = await this.getConnection(tenantId)
      await pool.query('SELECT 1')
      return true
    } catch (error) {
      console.error(`Connection test failed for tenant ${tenantId}:`, error)
      return false
    }
  }

  /**
   * Get connection status for all tenants
   */
  async getConnectionStatus(): Promise<Record<string, boolean>> {
    const tenants = await this.tenantManager.getAllTenants()
    const status: Record<string, boolean> = {}

    for (const tenant of tenants) {
      status[tenant.id] = await this.testConnection(tenant.id)
    }

    return status
  }
}
