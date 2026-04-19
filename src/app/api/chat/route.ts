export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { generateAIResponse } from '@/lib/ai/generate-response'

// ── GET: haal chatgeschiedenis op ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const messages = await query<{
      id: number
      role: string
      content: string
      actions: string
      created_at: string
    }>(`
      SELECT id, role, content, actions, created_at
      FROM chat_messages
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit])

    return NextResponse.json({
      data: messages.reverse().map(m => ({
        ...m,
        actions: (() => { try { return JSON.parse(m.actions || '[]') } catch { return [] } })(),
      })),
    })
  } catch (error: any) {
    console.error('[/api/chat GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST: verwerk chatbericht met streaming SSE ──────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message, sessionKey, imageBase64, imageType } = body

  if (!message?.trim() && !imageBase64) {
    return NextResponse.json({ error: 'Bericht is leeg' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // 1. Sla gebruikersbericht op
        await execute(
          `INSERT INTO chat_messages (role, content, actions) VALUES ('user', $1, $2)`,
          [message || '[afbeelding]', '[]']
        ).catch(console.error)

        // 2. Parse intent via AI (met optionele foto)
        send({ type: 'status', text: 'Denken...' })

        const aiResult = await parseCommandWithAI(
          message?.trim() || 'Analyseer deze afbeelding',
          sessionKey,
          imageBase64 ? { base64: imageBase64, mimeType: imageType || 'image/jpeg' } : undefined
        )

        if (!aiResult) {
          send({ type: 'error', text: 'Kon het bericht niet verwerken. Probeer het opnieuw.' })
          controller.close()
          return
        }

        // 3. Voer acties uit
        const hasActions = aiResult.actions.length > 0 && !aiResult.requires_confirmation
        if (hasActions) {
          send({ type: 'status', text: 'Acties uitvoeren...' })
        }

        const actionResults = hasActions
          ? await executeActions(aiResult.actions)
          : []

        // 4. Debug payload
        const debugInfo = {
          summary: aiResult.summary,
          actions: aiResult.actions.map((a, i) => ({
            type: a.type,
            payload: a.payload,
            result: actionResults[i] ?? null,
          })),
          requires_confirmation: aiResult.requires_confirmation,
          failed: actionResults.filter(r => !r.success).length,
        }

        send({ type: 'debug', data: debugInfo })

        // 5. Genereer response tekst
        const responseText = generateAIResponse(aiResult, actionResults, aiResult.requires_confirmation)

        // 6. Sla AI response op
        await execute(
          `INSERT INTO chat_messages (role, content, actions, session_key) VALUES ('assistant', $1, $2, $3)`,
          [responseText, JSON.stringify(debugInfo), sessionKey || null]
        ).catch(console.error)

        // 7. Stream tekst woord voor woord
        const words = responseText.split(' ')
        for (const word of words) {
          send({ type: 'text', text: word + ' ' })
          await new Promise(r => setTimeout(r, 25))
        }

        // 8. Klaar — stuur actie-samenvatting mee
        send({
          type: 'done',
          actionResults,
          debugInfo,
          requiresConfirmation: aiResult.requires_confirmation,
          pendingActions: aiResult.requires_confirmation ? aiResult.actions : [],
        })

      } catch (err: any) {
        console.error('[/api/chat POST stream]', err)
        send({ type: 'error', text: 'Er ging iets mis. Probeer opnieuw.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ── DELETE: verwijder chatgeschiedenis ───────────────────────────────────────

export async function DELETE() {
  try {
    await execute(`DELETE FROM chat_messages WHERE role != 'system'`)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
