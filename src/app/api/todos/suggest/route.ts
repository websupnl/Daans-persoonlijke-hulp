export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import OpenAI from 'openai'

export async function POST() {
  const todos = await query<{
    id: number; title: string; description: string | null
    priority: string; category: string; due_date: string | null
  }>(`
    SELECT id, title, description, priority, category, due_date::text
    FROM todos WHERE completed = 0
    ORDER BY due_date ASC NULLS LAST, priority DESC
    LIMIT 30
  `)

  if (!todos.length) {
    return NextResponse.json({ suggestion: 'Je hebt geen open todos — je bent helemaal bij!', top: [] })
  }

  const today = new Date().toISOString().split('T')[0]
  const todayLabel = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

  const list = todos.map(t =>
    `- [${t.priority.toUpperCase()}] ${t.title}` +
    (t.due_date ? ` (deadline: ${t.due_date})` : '') +
    (t.category !== 'overig' ? ` [${t.category}]` : '')
  ).join('\n')

  let suggestion = ''
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY ontbreekt')

    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 350,
      messages: [
        {
          role: 'system',
          content: `Je bent de persoonlijke assistent van Daan (25, elektricien bij Bouma + webdesigner bij WebsUp).
Geef direct, concreet advies over welke 3 todos hij NU moet aanpakken.
Leg per taak in één zin uit waarom. Gebruik bullet points (•). Geen preamble, ga direct in.`,
        },
        {
          role: 'user',
          content: `Vandaag is ${todayLabel}. Welke 3 taken moet ik nu als eerste doen?\n\n${list}`,
        },
      ],
    })
    suggestion = completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    suggestion = ''
  }

  // Score todos for ranking
  const now = new Date()
  const scored = todos.map(t => {
    let score = 0
    if (t.due_date) {
      const d = new Date(t.due_date)
      if (d < now) score += 200
      else if (t.due_date === today) score += 100
      else {
        const daysLeft = (d.getTime() - now.getTime()) / 86400000
        if (daysLeft <= 3) score += 70
        else if (daysLeft <= 7) score += 40
      }
    }
    if (t.priority === 'hoog') score += 50
    else if (t.priority === 'medium') score += 20
    return { ...t, _score: score }
  }).sort((a, b) => b._score - a._score)

  return NextResponse.json({ suggestion, top: scored.slice(0, 3) })
}
