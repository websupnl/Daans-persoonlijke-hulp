export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { text } = body
  if (!text?.trim()) return NextResponse.json({ error: 'Geen tekst opgegeven' }, { status: 400 })

  const projects = await query<{ id: number; title: string }>(`SELECT id, title FROM projects WHERE status = 'actief' ORDER BY title`)
  const projectList = projects.map(p => `  ${p.id}: ${p.title}`).join('\n')
  const todayStr = new Date().toISOString().split('T')[0]
  const nowIso = new Date().toISOString()

  const systemPrompt = `Je bent een tijdregistratie-assistent voor Daan. Zet de tekst om naar een JSON werklog.
Antwoord UITSLUITEND met geldige JSON, geen tekst eromheen.

Beschikbare projecten:
${projectList}

JSON schema:
{
  "title": "string of null",
  "project_id": number of null,
  "context": "Bouma" | "WebsUp" | "privé" | "studie" | "overig",
  "category": "work" | "business" | "private",
  "type": "deep_work" | "meeting" | "admin" | "physical" | "chill",
  "actual_duration_minutes": number of null,
  "expected_duration_minutes": number of null,
  "interruptions": "string of null",
  "difficulty": "easy" | "normal" | "hard",
  "source": "ai"
}

Regels:
- WebsUp, Camperhulp, Sjoeli, Prime Animals, SYNC → context "WebsUp", category "business"
- Bouma, installaties → context "Bouma", category "work"
- Sport, thuis, privé → context "privé", category "private"
- Coderen, bouwen, ontwerpen → type "deep_work"
- Bellen, vergadering → type "meeting"
- E-mail, administratie → type "admin"
- Sporten, klussen → type "physical"
- "dacht X uur, werd Y uur" → expected=X*60, actual=Y*60
- Vandaag is: ${todayStr}, huidige tijd: ${nowIso}`

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!anthropicKey && !openaiKey) {
    return NextResponse.json({ error: 'Geen AI API key geconfigureerd.' }, { status: 503 })
  }

  let parsed: Record<string, unknown> | null = null
  try {
    let rawContent = ''
    if (anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: systemPrompt, messages: [{ role: 'user', content: `Verwerk naar JSON: "${text}"` }] }),
      })
      rawContent = (await res.json()).content?.[0]?.text ?? ''
    } else if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 400, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Verwerk naar JSON: "${text}"` }] }),
      })
      rawContent = (await res.json()).choices?.[0]?.message?.content ?? ''
    }
    const match = rawContent.match(/\{[\s\S]*\}/)
    if (match) parsed = JSON.parse(match[0])
  } catch {
    return NextResponse.json({ error: 'AI parsing mislukt.' }, { status: 422 })
  }

  if (!parsed) return NextResponse.json({ error: 'Kon tekst niet verwerken.' }, { status: 422 })

  const dur = (parsed.actual_duration_minutes as number) || (parsed.expected_duration_minutes as number) || null

  const log = await queryOne(`
    INSERT INTO work_logs (title, duration_minutes, actual_duration_minutes, expected_duration_minutes,
      context, category, type, interruptions, source, date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ai', CURRENT_DATE)
    RETURNING *
  `, [
    (parsed.title as string) || text.slice(0, 80),
    dur,
    parsed.actual_duration_minutes as number || null,
    parsed.expected_duration_minutes as number || null,
    (parsed.context as string) || 'WebsUp',
    (parsed.category as string) || 'business',
    (parsed.type as string) || 'deep_work',
    (parsed.interruptions as string) || null,
  ])

  return NextResponse.json({ data: log, parsed }, { status: 201 })
}
