export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { processChatMessage } from '@/lib/chat/legacy/engine'

export async function GET() {
  const messages = await query<Record<string, unknown>>(`
    SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 50
  `)

  return NextResponse.json({
    data: messages.reverse().map((message) => ({
      ...message,
      actions: JSON.parse((message.actions as string) || '[]'),
    })),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message, sessionKey } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })
  }

  try {
    const result = await processChatMessage({
      message: message.trim(),
      source: 'chat',
      sessionKey,
    })

    return NextResponse.json({
      response: result.reply,
      success: true,
      actions: result.actions,
      debug: {
        parserType: result.parserType,
        confidence: result.confidence,
        intent: result.intent,
      },
    })
  } catch (err) {
    console.error('[/api/chat POST] Engine error:', err)
    return NextResponse.json({
      response: 'Er ging iets mis in de chat engine. Probeer opnieuw.',
      success: false,
      actions: [],
      debug: { error: String(err) },
    }, { status: 500 })
  }
}
