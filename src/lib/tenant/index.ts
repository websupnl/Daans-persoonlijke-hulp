// Multi-Tenant System Exports
export { TenantManager } from './TenantManager'
export { DatabaseRouter } from './DatabaseRouter'
export { TenantContextManager, TenantContext } from './TenantContext'
export { TelegramBotManager } from './TelegramBotManager'

export type { Tenant, User } from './TenantManager'
export type { TelegramBotConfig } from './TelegramBotManager'

// Convenience function for getting tenant context
import { TenantContextManager } from './TenantContext'

export async function getTenantContext() {
  const manager = TenantContextManager.getInstance()
  return await manager.getContextFromHeaders()
}

// Convenience function for getting tenant database helpers
export async function getTenantDatabase() {
  const context = await getTenantContext()
  if (!context) throw new Error('No tenant context found')
  
  const manager = TenantContextManager.getInstance()
  return manager.getTenantDatabaseHelpers(context)
}
