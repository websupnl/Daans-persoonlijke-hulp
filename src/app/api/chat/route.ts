export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { processChatMessage } from '@/lib/chat/SimpleChatProcessor'

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
  const { message } = body

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })
  }

  const result = await processChatMessage(message)

  return NextResponse.json({
    response: result.message,
    success: result.success,
    actions: result.actions,
    debug: result.debug,
  })
}
