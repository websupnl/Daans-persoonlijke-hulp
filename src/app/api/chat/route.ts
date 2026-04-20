export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { generateAIResponse } from '@/lib/ai/generate-response'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'
import { ChatActionResult } from '@/lib/contracts/chat-action-result'

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

    return jsonOk(messages.reverse().map(m => ({
        ...m,
        actions: (() => { try { return JSON.parse(m.actions || '[]') } catch { return [] } })(),
      })), undefined, req)
  } catch (error: any) {
    console.error('[/api/chat GET]', error)
    return jsonFail('CHAT_HISTORY_FAILED', 'Kon chatgeschiedenis niet ophalen', 500, error, req)
  }
}

// ── POST: verwerk chatbericht met streaming SSE ──────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { message, sessionKey, imageBase64, imageType } = body

  if (!message?.trim() && !imageBase64) {
    return jsonFail('CHAT_EMPTY_MESSAGE', 'Bericht is leeg', 400, undefined, req)
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
        const contractedActionResults: ChatActionResult[] = actionResults.map((result) => ({
          action: result.type,
          attempted: true,
          executed: result.success,
          verified: result.success,
          userMessage: result.success
            ? `${result.type} succesvol uitgevoerd`
            : (result.error || `${result.type} niet uitgevoerd`),
          details: result.data,
        }))

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

        // 6. Sla AI response op (zonder session_key — kolom bestaat niet)
        await execute(
          `INSERT INTO chat_messages (role, content, actions) VALUES ('assistant', $1, $2)`,
          [responseText, JSON.stringify(debugInfo)]
        ).catch(console.error)

        // 7. Stream tekst woord voor woord via OpenAI streaming
        const client = (await import('@/lib/ai/openai-client')).getOpenAIClient()
        const streamResponse = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Je bent Daan\'s persoonlijke assistent. Geef een korte, natuurlijke Nederlandse bevestiging van wat je zojuist hebt gedaan. Max 2 zinnen. Geen lijst, geen opsomming.' },
            { role: 'user', content: responseText },
          ],
          stream: true,
          max_tokens: 200,
          temperature: 0.7,
        })

        for await (const chunk of streamResponse) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) send({ type: 'text', text })
        }

        // 8. Klaar — stuur actie-samenvatting mee
        send({
          type: 'done',
          actionResults: contractedActionResults,
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
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Vercel/nginx: disable response buffering
    },
  })
}

// ── DELETE: verwijder chatgeschiedenis ───────────────────────────────────────

export async function DELETE() {
  try {
    await execute(`DELETE FROM chat_messages WHERE role != 'system'`)
    return jsonOk({ deleted: true })
  } catch (error: any) {
    return jsonFail('CHAT_DELETE_FAILED', 'Kon chatgeschiedenis niet verwijderen', 500, error)
  }
}
