export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { text } = body
  if (!text?.trim()) return NextResponse.json({ error: 'Geen tekst opgegeven' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Geen OpenAI API key geconfigureerd.' }, { status: 503 })
  }

  const projects = await query<{ id: number; title: string }>(`SELECT id, title FROM projects WHERE status = 'actief' ORDER BY title`)
  const projectList = projects.map(p => `  ${p.id}: ${p.title}`).join('\n')
  const todayStr = new Date().toISOString().split('T')[0]

  const systemPrompt = `Je bent een tijdregistratie-assistent voor Daan. Zet de tekst om naar een JSON werklog.
Antwoord UITSLUITEND met geldige JSON, geen tekst eromheen.

Beschikbare projecten:
${projectList || '  (geen actieve projecten)'}

Vandaag: ${todayStr}

JSON schema (vul alle velden in):
{
  "title": "string",
  "project_id": number of null,
  "context": "Bouma" | "WebsUp" | "privé" | "studie" | "overig",
  "category": "work" | "business" | "private",
  "type": "deep_work" | "meeting" | "admin" | "physical" | "chill",
  "actual_duration_minutes": number of null,
  "expected_duration_minutes": number of null,
  "interruptions": "string of null",
  "difficulty": "easy" | "normal" | "hard"
}

Regels:
- WebsUp, Camperhulp, Sjoeli, Prime Animals, SYNC → context "WebsUp", category "business"
- Bouma, installaties, elektra → context "Bouma", category "work"
- Sport, thuis, privé → context "privé", category "private"
- Studie, leren, cursus → context "studie", category "private"
- Coderen, bouwen, ontwerpen → type "deep_work"
- Bellen, vergadering, meeting → type "meeting"
- E-mail, administratie, factuur → type "admin"
- Sporten, klussen, lopen → type "physical"
- "dacht X uur, werd Y uur" → expected=X*60, actual=Y*60
- Tijden als "2u", "2 uur", "2h" → 120 minuten
- Tijden als "30 min", "45m" → dat aantal minuten
- "van 09:00 tot 11:30" → actual=150 minuten`

  let parsed: Record<string, unknown> | null = null

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Verwerk naar JSON: "${text}"` },
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content
    if (raw) parsed = JSON.parse(raw)
  } catch (err) {
    console.error('AI worklog parse error:', err)
    return NextResponse.json({ error: 'AI verwerking mislukt.' }, { status: 422 })
  }

  if (!parsed) return NextResponse.json({ error: 'Kon tekst niet verwerken.' }, { status: 422 })

  const actualDur = typeof parsed.actual_duration_minutes === 'number' ? parsed.actual_duration_minutes : null
  const expectedDur = typeof parsed.expected_duration_minutes === 'number' ? parsed.expected_duration_minutes : null
  const dur = actualDur ?? expectedDur

  const log = await queryOne(`
    INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, expected_duration_minutes,
      context, category, type, interruptions, source, date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai', CURRENT_DATE)
    RETURNING *
  `, [
    String(parsed.title || text).slice(0, 120),
    dur,
    actualDur,
    expectedDur,
    String(parsed.context || 'overig'),
    String(parsed.category || 'business'),
    String(parsed.type || 'deep_work'),
    parsed.interruptions ? String(parsed.interruptions) : null,
  ])

  return NextResponse.json({ data: log, parsed }, { status: 201 })
}
