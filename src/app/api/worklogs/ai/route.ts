export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { text } = body
  if (!text?.trim()) return NextResponse.json({ error: 'Geen tekst opgegeven' }, { status: 400 })

  const db = await getDb()
  const projects = toRows(await db.execute({
    sql: "SELECT id, title FROM projects WHERE status = 'actief' ORDER BY title",
    args: [],
  }))
  const projectList = projects.map(p => `  ${p.id}: ${p.title}`).join('\n')
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const nowIso = today.toISOString()

  const systemPrompt = `Je bent een tijdregistratie-assistent voor Daan. Zet de tekst om naar een JSON worklog.
Antwoord UITSLUITEND met geldige JSON, geen tekst eromheen.

Beschikbare projecten:
${projectList}

JSON schema:
{
  "title": "string of null",
  "project_id": number of null,
  "category": "work" | "business" | "private",
  "type": "deep_work" | "meeting" | "admin" | "physical" | "chill",
  "start_time": "ISO-8601 datetime string of null",
  "end_time": "ISO-8601 datetime string of null",
  "actual_duration_minutes": number of null,
  "expected_duration_minutes": number of null,
  "difficulty": "easy" | "normal" | "hard",
  "context_notes": "string of null",
  "interruptions": "string of null",
  "billable": true of false
}

Categorisatieregels (verplicht volgen):
- WebsUp, Camperhulp, Sjoeli, Camperrubbers, Prime Animals, SYNC → "business"
- Bouma, installaties, elektra → "work"
- Sport, thuis, familie, vriendin, boodschappen → "private"
- Avond (na 17:00) + business project → "business"
- Tijdsduur: "X uur" = X×60 minuten, "X.5 uur" = X×60+30 minuten

Type-regels:
- Coderen, bouwen, ontwerpen, concentreren → "deep_work"
- Bellen, vergadering, meeting, bespreking → "meeting"
- E-mail, administratie, planning, facturatie → "admin"
- Installatie, klussen, sporten, rijden → "physical"
- Pauze, ontspanning, tv → "chill"

Tijdsberekening:
- Vandaag is: ${todayStr}
- Huidige tijd: ${nowIso}
- "Van HH:MM tot HH:MM" → bereken start_time en end_time voor vandaag
- Als alleen duur bekend → stel start_time = now - actual_duration_minutes
- "Dacht X uur, werd Y uur" → expected=X×60, actual=Y×60
- Onderbrekingen herkennen: "door X", "omdat X", "want X langskwam"`

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
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: 'user', content: `Verwerk naar worklog JSON: "${text}"` }],
        }),
      })
      const data = await res.json()
      rawContent = data.content?.[0]?.text || ''
    } else if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 400,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Verwerk naar worklog JSON: "${text}"` },
          ],
        }),
      })
      const data = await res.json()
      rawContent = data.choices?.[0]?.message?.content || ''
    }

    const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    }
  } catch {
    return NextResponse.json({ error: 'AI parsing mislukt. Probeer opnieuw.' }, { status: 422 })
  }

  if (!parsed) {
    return NextResponse.json({ error: 'Kon tekst niet omzetten naar worklog.' }, { status: 422 })
  }

  // Bereken start_time als die niet gegeven is maar duur wel
  let startTime = (parsed.start_time as string) || null
  const actualDur = parsed.actual_duration_minutes as number | null
  if (!startTime && actualDur) {
    startTime = new Date(Date.now() - actualDur * 60000).toISOString()
  } else if (!startTime) {
    startTime = new Date().toISOString()
  }

  const dur = actualDur || (parsed.expected_duration_minutes as number) || null
  const id = `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  await db.execute({
    sql: `INSERT INTO worklogs
      (id, title, description, project_id, category, type, start_time, end_time,
       duration_minutes, expected_duration_minutes, actual_duration_minutes,
       difficulty, context_notes, interruptions, billable, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      (parsed.title as string) || text.slice(0, 80),
      null,
      parsed.project_id ? Number(parsed.project_id) : null,
      (parsed.category as string) || 'business',
      (parsed.type as string) || 'deep_work',
      startTime,
      (parsed.end_time as string) || null,
      dur,
      (parsed.expected_duration_minutes as number) || null,
      actualDur,
      (parsed.difficulty as string) || 'normal',
      (parsed.context_notes as string) || null,
      (parsed.interruptions as string) || null,
      parsed.billable ? 1 : 0,
      'ai',
    ],
  })

  const row = toRow(await db.execute({
    sql: 'SELECT w.*, p.title as project_title FROM worklogs w LEFT JOIN projects p ON w.project_id = p.id WHERE w.id = ?',
    args: [id],
  }))

  return NextResponse.json({ data: row, parsed }, { status: 201 })
}
