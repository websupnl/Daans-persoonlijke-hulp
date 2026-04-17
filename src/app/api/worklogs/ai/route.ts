export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { buildChatContext } from '@/lib/chat/context'
import { executeChatActions, planMessage } from '@/lib/chat/engine'
import type { ChatAction, StoredAction } from '@/lib/chat/types'

function formatCreatedReply(actions: StoredAction[]): string {
  const first = actions[0]
  if (!first) return 'Opgeslagen.'

  if (first.type === 'worklog_created') {
    return `Opgeslagen als werklog: ${first.data.title}`
  }

  if (first.type === 'timeline_logged') {
    return `Opgeslagen op je timeline: ${first.data.title}`
  }

  return 'Opgeslagen.'
}

function buildProposalReply(message: string, actions: ChatAction[], clarification?: string): string {
  if (clarification) return clarification
  if (actions.length === 0) return `Ik kon hier nog geen veilige actie uit halen uit "${message}".`

  const lines = actions.map((action) => {
    switch (action.type) {
      case 'worklog_create':
        return `- Werklog: ${action.payload.title} (${action.payload.duration_minutes} min, ${action.payload.context})`
      case 'timeline_log':
        return `- Timeline: ${action.payload.title}`
      case 'memory_store':
        return `- Memory: ${action.payload.value}`
      case 'habit_log':
        return `- Gewoonte: ${action.payload.habit_name}`
      default:
        return `- ${action.type}`
    }
  })

  return `Ik zie hier meerdere mogelijke acties:\n${lines.join('\n')}\n\nBevestig alleen als dit klopt.`
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const text = String(body.text || '').trim()
  const confirm = body.confirm === true
  const actions = Array.isArray(body.actions) ? body.actions as ChatAction[] : []

  const context = await buildChatContext('chat', 'chat')

  if (confirm) {
    if (actions.length === 0) {
      return NextResponse.json({ error: 'Geen acties om te bevestigen.' }, { status: 400 })
    }
    const executed = await executeChatActions(actions, context)
    return NextResponse.json({
      mode: 'created',
      reply: formatCreatedReply(executed.actions),
      actions: executed.actions,
    }, { status: 201 })
  }

  if (!text) return NextResponse.json({ error: 'Geen tekst opgegeven' }, { status: 400 })

  const plan = planMessage(text, context)

  if (
    plan.primaryIntent === 'worklog_create' &&
    plan.actions.length === 1 &&
    plan.actions[0]?.type === 'worklog_create' &&
    !plan.requiresConfirmation &&
    !plan.clarification
  ) {
    const executed = await executeChatActions(plan.actions, context)
    return NextResponse.json({
      mode: 'created',
      reply: formatCreatedReply(executed.actions),
      actions: executed.actions,
    }, { status: 201 })
  }

  return NextResponse.json({
    mode: 'proposal',
    reply: buildProposalReply(text, plan.actions, plan.clarification),
    actions: plan.actions,
    intent: plan.primaryIntent,
    confidence: plan.confidence,
    requiresConfirmation: plan.requiresConfirmation ?? plan.actions.length > 0,
  }, { status: 202 })
}
