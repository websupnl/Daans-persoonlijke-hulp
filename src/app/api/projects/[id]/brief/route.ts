export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { queryOne, query } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id)

  const [project, todos, worklogs, finance, notes] = await Promise.all([
    queryOne<{ id: number; title: string; description: string | null; status: string; created_at: string }>(`SELECT * FROM projects WHERE id = $1`, [id]),
    query<{ title: string; priority: string; completed: number; due_date: string | null }>(`SELECT title, priority, completed, due_date FROM todos WHERE project_id = $1 ORDER BY completed ASC, created_at DESC LIMIT 20`, [id]),
    query<{ title: string; duration_minutes: number; date: string; context: string }>(`SELECT title, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes, date, context FROM work_logs WHERE project_id = $1 ORDER BY date DESC LIMIT 20`, [id]),
    query<{ type: string; title: string; amount: number; status: string }>(`SELECT type, title, amount, status FROM finance_items WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10`, [id]),
    query<{ title: string; content_text: string }>(`SELECT title, content_text FROM notes WHERE project_id = $1 ORDER BY created_at DESC LIMIT 5`, [id]),
  ])

  if (!project) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const totalMinutes = worklogs.reduce((s, w) => s + (w.duration_minutes || 0), 0)
  const openTodos = todos.filter(t => !t.completed)
  const doneTodos = todos.filter(t => t.completed)
  const overdueTodos = openTodos.filter(t => t.due_date && t.due_date < new Date().toISOString().split('T')[0])

  const prompt = `Je bent een project-assistent voor Daan. Analyseer dit project en geef een beknopte AI-brief (max 5 zinnen).

Project: ${project.title} (${project.status})
Beschrijving: ${project.description || 'geen'}
Aangemaakt: ${project.created_at?.toString().split('T')[0]}

Taken: ${openTodos.length} open, ${doneTodos.length} gedaan, ${overdueTodos.length} VERLOPEN
Open taken: ${openTodos.slice(0, 5).map(t => `"${t.title}" [${t.priority}]`).join(', ') || 'geen'}

Gewerkt: ${Math.round(totalMinutes / 60 * 10) / 10} uur totaal
Recente sessies: ${worklogs.slice(0, 5).map(w => `${w.date}: ${Math.round((w.duration_minutes || 0) / 60 * 10) / 10}u`).join(', ') || 'geen'}

Financiën: ${finance.map(f => `${f.type} €${f.amount} (${f.status})`).join(', ') || 'geen'}

Notes: ${notes.map(n => n.title).join(', ') || 'geen'}

Geef een beknopte analyse: projectstatus, aandachtspunten, wat er als volgende moet gebeuren. Schrijf in het Nederlands, direct en zakelijk. Geen opsommingen, gewone zinnen.`

  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 400,
  })

  const brief = response.choices[0]?.message?.content ?? 'Geen brief beschikbaar.'
  return NextResponse.json({ brief })
}
