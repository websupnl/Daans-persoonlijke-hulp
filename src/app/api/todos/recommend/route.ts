import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ recommendation: 'AI-aanbevelingen zijn nu niet beschikbaar omdat er geen OpenAI-sleutel is ingesteld.' }, { status: 503 })
    }

    const todos = await query<any>(
      `SELECT t.*, p.title as project_title 
       FROM todos t 
       LEFT JOIN projects p ON t.project_id = p.id 
       WHERE t.completed = 0 
       ORDER BY t.priority DESC, t.due_date ASC NULLS LAST`
    )

    if (todos.length === 0) {
      return NextResponse.json({ recommendation: 'Je bent helemaal bij! Geniet van je vrije tijd of begin aan iets nieuws.' })
    }

    const todoList = todos.map(t => ({
      title: t.title,
      priority: t.priority,
      category: t.category,
      due_date: t.due_date,
      project: t.project_title,
    }))

    const completion = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Je bent een productiviteitsassistent. Gegeven een lijst met taken, kies de ÉÉN meest logische volgende taak voor de gebruiker om nu aan te werken. Leg kort uit waarom (1-2 zinnen). Antwoord in het Nederlands. Wees motiverend maar zakelijk.'
        },
        {
          role: 'user',
          content: `Hier zijn mijn openstaande taken:\n${JSON.stringify(todoList, null, 2)}`
        }
      ],
      max_tokens: 200,
    })

    const recommendation = completion.choices[0]?.message?.content || 'Kon geen aanbeveling doen.'

    return NextResponse.json({ recommendation })
  } catch (error) {
    console.error('Error in todo recommendation:', error)
    return NextResponse.json({ error: 'Fout bij het ophalen van aanbeveling' }, { status: 500 })
  }
}
