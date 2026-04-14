import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { buildContext, formatContextForPrompt } from '@/lib/ai/build-context'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'day'

  const ctx = await buildContext(10)
  const contextString = formatContextForPrompt(ctx)

  const overdueRow = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM todos WHERE completed = 0 AND due_date::date < CURRENT_DATE`)
  const overdueCount = overdueRow?.count ?? 0
  const highPriorityTodos = await query(`SELECT id, title, due_date, category FROM todos WHERE completed = 0 AND priority = 'hoog' ORDER BY due_date ASC LIMIT 5`)
  const quickTodos = await query(`SELECT id, title FROM todos WHERE completed = 0 AND priority = 'laag' ORDER BY created_at DESC LIMIT 5`)

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      type,
      recommendation: `**Vandaag focuspunten:**\n${(highPriorityTodos as Array<{ id: number; title: string }>).map(t => `- ${t.title}`).join('\n')}\n\n${overdueCount > 0 ? `⚠️ ${overdueCount} verlopen taken` : ''}`,
      highPriority: highPriorityTodos,
      quick: quickTodos,
      overdueCount,
    })
  }

  const client = getOpenAIClient()
  const typeLabel = type === 'week' ? 'weekplanning' : 'dagplanning'

  const aiResponse = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `Je bent een persoonlijke coach die een ${typeLabel} maakt. Geef een concreet, prioriteit-gebaseerd voorstel in het Nederlands. Maximaal 300 woorden. Gebruik markdown.` },
      { role: 'user', content: contextString },
    ],
    temperature: 0.3,
    max_tokens: 400,
  })

  return NextResponse.json({
    type,
    recommendation: aiResponse.choices[0]?.message?.content ?? 'Geen aanbeveling beschikbaar',
    highPriority: highPriorityTodos,
    quick: quickTodos,
    overdueCount,
  })
}
