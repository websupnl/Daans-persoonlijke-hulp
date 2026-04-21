export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, execute } from '@/lib/db'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { generateAIResponse } from '@/lib/ai/generate-response'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'
import { ChatActionResult } from '@/lib/contracts/chat-action-result'
import { ensureWorkspaceColumns, getWorkspaceFromRequest, migrateLegacyBoumaWorkspace } from '@/lib/workspace'

export async function GET(req: NextRequest) {
  try {
    await migrateLegacyBoumaWorkspace(['chat_messages'])
    const workspace = getWorkspaceFromRequest(req)
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
      WHERE workspace = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [workspace, limit])

    return jsonOk(messages.reverse().map((m) => ({
      ...m,
      actions: (() => {
        try {
          return JSON.parse(m.actions || '[]')
        } catch {
          return []
        }
      })(),
    })), undefined, req)
  } catch (error: unknown) {
    console.error('[/api/chat GET]', error)
    return jsonFail('CHAT_HISTORY_FAILED', 'Kon chatgeschiedenis niet ophalen', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  await ensureWorkspaceColumns(['chat_messages'])
  const workspace = getWorkspaceFromRequest(req)
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
        await execute(
          `INSERT INTO chat_messages (role, content, actions, workspace) VALUES ('user', $1, $2, $3)`,
          [message || '[afbeelding]', '[]', workspace]
        ).catch(console.error)

        send({ type: 'status', text: 'Bericht begrijpen...' })

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

        const hasActions = aiResult.actions.length > 0 && !aiResult.requires_confirmation
        if (hasActions) {
          send({ type: 'status', text: 'Acties uitvoeren...' })
        }

        const actionResults = hasActions
          ? await executeActions(aiResult.actions, { workspace })
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

        const debugInfo = {
          summary: aiResult.summary,
          actions: aiResult.actions.map((action, index) => ({
            type: action.type,
            payload: action.payload,
            result: actionResults[index] ?? null,
          })),
          requires_confirmation: aiResult.requires_confirmation,
          failed: actionResults.filter((result) => !result.success).length,
        }

        send({ type: 'debug', data: debugInfo })

        const responseText = generateAIResponse(aiResult, actionResults, aiResult.requires_confirmation)

        await execute(
          `INSERT INTO chat_messages (role, content, actions, workspace) VALUES ('assistant', $1, $2, $3)`,
          [responseText, JSON.stringify(debugInfo), workspace]
        ).catch(console.error)

        send({ type: 'text', text: responseText })

        send({
          type: 'done',
          actionResults: contractedActionResults,
          debugInfo,
          requiresConfirmation: aiResult.requires_confirmation,
          pendingActions: aiResult.requires_confirmation ? aiResult.actions : [],
        })
      } catch (error: unknown) {
        console.error('[/api/chat POST stream]', error)
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
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureWorkspaceColumns(['chat_messages'])
    const workspace = getWorkspaceFromRequest(req)
    await execute(`DELETE FROM chat_messages WHERE role != 'system' AND workspace = $1`, [workspace])
    return jsonOk({ deleted: true }, undefined, req)
  } catch (error: unknown) {
    return jsonFail('CHAT_DELETE_FAILED', 'Kon chatgeschiedenis niet verwijderen', 500, error, req)
  }
}
