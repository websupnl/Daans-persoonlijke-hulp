/**
 * Worklogs AI API
 * Natural language worklog creation via AI
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseCommandWithAI } from '@/lib/ai/parse-command'
import { executeActions } from '@/lib/ai/execute-actions'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, sessionKey } = body

    if (!text?.trim()) {
      return jsonFail('EMPTY_INPUT', 'Geen tekst ontvangen', 400, undefined, request)
    }

    // Parse the natural language input via AI
    const aiResult = await parseCommandWithAI(
      text.trim(),
      sessionKey,
      undefined
    )

    if (!aiResult) {
      return jsonFail('PARSE_FAILED', 'Kon de invoer niet verwerken', 500, undefined, request)
    }

    // Filter for worklog-related actions only
    const worklogActions = aiResult.actions.filter(a => 
      a.type === 'worklog_create' || 
      a.type === 'worklog_update_last' ||
      a.type === 'timer_start' ||
      a.type === 'timer_stop'
    )

    if (worklogActions.length === 0) {
      return jsonOk({
        reply: 'Ik begreep dat je iets wilt loggen, maar kon geen werklog details herkennen. Probeer iets als "2 uur aan Prime Animals" of "van 14:00 tot 16:00 Sjoeli".',
        parsed: null,
        created: null
      }, undefined, request)
    }

    // Execute only worklog actions
    const actionResults = await executeActions(worklogActions)
    const successResults = actionResults.filter(r => r.success)
    const failedResults = actionResults.filter(r => !r.success)

    // Build response message
    let reply: string
    if (successResults.length > 0) {
      const result = successResults[0]
      if (result.type === 'worklog_create') {
        reply = `✓ Werklog toegevoegd: "${result.data?.title}" (${result.data?.duration_minutes} minuten)`
      } else if (result.type === 'worklog_update_last') {
        reply = `✓ Laatste werklog bijgewerkt naar ${result.data?.duration_minutes} minuten`
      } else if (result.type === 'timer_start') {
        reply = `✓ Timer gestart: "${result.data?.title}"`
      } else if (result.type === 'timer_stop') {
        reply = `✓ Timer gestopt. Werklog aangemaakt: "${result.data?.title}" (${result.data?.duration_minutes} min)`
      } else {
        reply = '✓ Actie uitgevoerd'
      }
    } else if (failedResults.length > 0) {
      reply = `❗ ${failedResults[0].error || 'Er ging iets mis bij het aanmaken van het werklog'}`
    } else {
      reply = aiResult.summary || 'Werklog verwerkt'
    }

    return jsonOk({
      reply,
      parsed: worklogActions[0]?.payload,
      created: successResults.length > 0 ? {
        id: successResults[0].data?.id,
        type: successResults[0].type,
        ...successResults[0].data
      } : null,
      requires_confirmation: aiResult.requires_confirmation,
      debug: {
        actions: worklogActions,
        results: actionResults
      }
    }, undefined, request)

  } catch (error: any) {
    console.error('[Worklogs AI]', error)
    return jsonFail('WORKLOG_AI_ERROR', 'Fout bij verwerken werklog', 500, error, request)
  }
}
