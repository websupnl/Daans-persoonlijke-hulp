import { NextRequest, NextResponse } from 'next/server'
import { TelegramBotManager } from '@/lib/tenant/TelegramBotManager'
import { TenantManager } from '@/lib/tenant/TenantManager'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const { tenantId } = params
    const update = await req.json()

    // Validate tenant exists
    const tenantManager = TenantManager.getInstance()
    const tenant = await tenantManager.getTenant(tenantId)
    
    if (!tenant) {
      console.error(`Tenant ${tenantId} not found for webhook`)
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Validate webhook token if provided
    const telegramToken = req.headers.get('x-telegram-bot-token')
    if (telegramToken && telegramToken !== tenant.telegram_bot_token) {
      console.error(`Invalid webhook token for tenant ${tenantId}`)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Process update with tenant-specific bot manager
    const botManager = TelegramBotManager.getInstance()
    await botManager.processUpdate(update)

    return NextResponse.json({ ok: true })

  } catch (error: any) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ 
      error: error.message || 'Webhook processing failed' 
    }, { status: 500 })
  }
}

// Handle webhook verification (GET request)
export async function GET(req: NextRequest, { params }: { params: { tenantId: string } }) {
  try {
    const { tenantId } = params
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    const tenantManager = TenantManager.getInstance()
    const tenant = await tenantManager.getTenant(tenantId)
    
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    if (token !== tenant.telegram_bot_token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    return NextResponse.json({ 
      ok: true, 
      tenant: tenant.id,
      bot_username: tenant.telegram_bot_username 
    })

  } catch (error: any) {
    console.error('Telegram webhook verification error:', error)
    return NextResponse.json({ 
      error: error.message || 'Webhook verification failed' 
    }, { status: 500 })
  }
}
