import { NextRequest, NextResponse } from 'next/server'
import { TenantManager } from '@/lib/tenant/TenantManager'
import { DatabaseRouter } from '@/lib/tenant/DatabaseRouter'
import { TelegramBotManager } from '@/lib/tenant/TelegramBotManager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const tenantManager = TenantManager.getInstance()
    const dbRouter = DatabaseRouter.getInstance()
    const botManager = TelegramBotManager.getInstance()

    // Get all tenants
    const tenants = await tenantManager.getAllTenants()

    // Get status for each tenant
    const tenantsWithStatus = await Promise.all(
      tenants.map(async (tenant) => {
        const [dbStatus, botStatus] = await Promise.all([
          dbRouter.testConnection(tenant.id).catch(() => false),
          botManager.getBotConfig(tenant.id) ? true : false
        ])

        return {
          ...tenant,
          database_status: dbStatus,
          bot_status: botStatus
        }
      })
    )

    return NextResponse.json({
      tenants: tenantsWithStatus,
      count: tenantsWithStatus.length
    })

  } catch (error: any) {
    console.error('Tenant list error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch tenants' 
    }, { status: 500 })
  }
}
