export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { TenantContextManager } from '@/lib/tenant/TenantContext'
import { SimpleChatProcessor } from '@/lib/chat/SimpleChatProcessor'

export async function GET(req: NextRequest) {
  try {
    const contextManager = TenantContextManager.getInstance()
    const context = await contextManager.getContextFromHeaders()
    
    if (!context) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 401 })
    }

    // Get messages from tenant-specific database
    const db = contextManager.getTenantDatabaseHelpers(context)
    const messages = await db.query(`
      SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50
    `)

    return NextResponse.json({
      data: messages.reverse().map((message) => ({
        ...message,
        actions: JSON.parse((message.actions as string) || '[]'),
      })),
    })
  } catch (error: any) {
    console.error('[/api/chat GET] Error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch messages' 
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, sessionKey } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })
    }

    // Get tenant context
    const contextManager = TenantContextManager.getInstance()
    const context = await contextManager.getContextFromHeaders()
    
    if (!context) {
      return NextResponse.json({ error: 'No tenant context found' }, { status: 401 })
    }

    // Process message with tenant-specific chat processor
    const processor = new SimpleChatProcessor()
    const result = await processor.processChatMessage(message.trim(), {
      tenant_id: context.tenant.id,
      user_id: context.user?.id,
      database: context.database,
      sessionKey
    })

    return NextResponse.json({
      response: result.reply,
      success: true,
      actions: result.actions,
      debug: {
        parserType: result.parserType,
        confidence: result.confidence,
        intent: result.intent,
        tenant_id: context.tenant.id,
        user_id: context.user?.id
      },
    })
  } catch (err: any) {
    console.error('[/api/chat POST] Engine error:', err)
    return NextResponse.json({
      response: 'Er ging iets mis in de chat engine. Probeer opnieuw.',
      success: false,
      actions: [],
      debug: { error: String(err) },
    }, { status: 500 })
  }
}
