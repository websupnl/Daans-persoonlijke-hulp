export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const rawText = String(body.raw_text || '').trim()

  if (!rawText) return NextResponse.json({ error: 'raw_text is verplicht' }, { status: 400 })

  const [projects, contacts] = await Promise.all([
    query<{ id: number; title: string }>('SELECT id, title FROM projects ORDER BY title LIMIT 30'),
    query<{ id: number; name: string; company?: string }>('SELECT id, name, company FROM contacts ORDER BY name LIMIT 50'),
  ])

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      suggestion: {
        type: 'inbox',
        confidence: 0.3,
        project_id: null,
        contact_id: null,
        company: null,
        summary: rawText,
        action_advice: 'Sla dit op in inbox en verwerk later.',
      },
    })
  }

  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Classificeer één inbox-item voor Daan. Geef alleen JSON terug:
{
  "type": "todo|note|event|finance|worklog|idea|memory|contact|inbox",
  "confidence": 0-1,
  "project_id": number|null,
  "contact_id": number|null,
  "company": "string|null",
  "summary": "korte samenvatting",
  "action_advice": "wat ermee moet gebeuren"
}
Kies project/contact alleen als er duidelijke match is.`,
      },
      {
        role: 'user',
        content: `Inbox tekst: ${rawText}

Projecten:
${projects.map((project) => `${project.id}: ${project.title}`).join('\n') || 'geen'}

Contacten:
${contacts.map((contact) => `${contact.id}: ${contact.name}${contact.company ? ` (${contact.company})` : ''}`).join('\n') || 'geen'}`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content
  const suggestion = raw ? JSON.parse(raw) : null
  return NextResponse.json({ suggestion })
}
