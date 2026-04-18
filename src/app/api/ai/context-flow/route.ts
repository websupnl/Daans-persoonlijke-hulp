export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/context-flow
 *
 * Twee modes:
 * 1. Analyse (execute = false/absent):
 *    → Geeft suggesties terug voor het item: gerelateerde projecten, te maken worklogs, etc.
 *
 * 2. Uitvoering (execute = true):
 *    → Voert de geselecteerde suggesties uit.
 *
 * Het systeem denkt eerst na vóór opslaan:
 * een todo kan ook te maken hebben met een project, werklog, notitie, contact.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { query, queryOne, execute } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Context loader
// ─────────────────────────────────────────────────────────────────────────────

async function loadContext() {
  const [projects, memory, ideas] = await Promise.all([
    query<{ id: number; title: string; status: string }>(
      `SELECT id, title, status FROM projects WHERE status != 'afgerond' ORDER BY updated_at DESC LIMIT 20`
    ).catch(() => []),
    query<{ key: string; value: string }>(
      `SELECT key, value FROM memory_log ORDER BY last_reinforced_at DESC LIMIT 30`
    ).catch(() => []),
    query<{ id: number; title: string }>(
      `SELECT id, title FROM ideas ORDER BY created_at DESC LIMIT 15`
    ).catch(() => []),
  ])
  return { projects, memory, ideas }
}

// ─────────────────────────────────────────────────────────────────────────────
// Analyser
// ─────────────────────────────────────────────────────────────────────────────

async function analyseItem(type: string, title: string, content?: string) {
  const ctx = await loadContext()
  const client = getOpenAIClient()
  const today = new Date().toISOString().split('T')[0]

  const systemPrompt = `Je bent een context-analyse AI voor Daan's persoonlijk OS.
Vandaag: ${today}

ACTIEVE PROJECTEN:
${ctx.projects.map(p => `- ${p.title} (ID: ${p.id})`).join('\n') || '(geen)'}

RECENTE MEMORY:
${ctx.memory.slice(0, 15).map(m => `${m.key}: ${m.value.slice(0, 60)}`).join('\n') || '(geen)'}

RECENTE IDEEËN:
${ctx.ideas.map(i => `- ${i.title} (ID: ${i.id})`).join('\n') || '(geen)'}

TAAK: Analyseer het item. Geef korte, nuttige suggesties voor verbindingen.
Denk na: kan dit item te maken hebben met een project? Moet er een werklog van gemaakt worden?
Is er een notitie, idee of todo die hier logisch bij hoort?

REGELS:
- Max 4 suggesties
- Alleen als het echt zin heeft — geen ruis
- auto=true voor acties die je sterk aanbeveelt
- Wees beknopt in descriptions (max 1 zin)

OUTPUT: Alleen JSON.
{
  "summary": "Korte analyse in 1 zin",
  "context_notes": ["opmerking 1", "opmerking 2"],
  "suggestions": [
    {
      "id": "uniek-id",
      "type": "link_project|create_worklog|create_note|create_idea|create_todo|update_memory|link_contact",
      "label": "Korte actienaam",
      "description": "Waarom dit nuttig is",
      "payload": {},
      "auto": true/false
    }
  ]
}`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Type: ${type}\nTitel: ${title}\n${content ? `Inhoud: ${content.slice(0, 500)}` : ''}` },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(raw)
  } catch {
    return { summary: 'Analyse mislukt', context_notes: [], suggestions: [] }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute suggestions
// ─────────────────────────────────────────────────────────────────────────────

async function executeSuggestions(
  suggestions: Array<{ type: string; label: string; payload: Record<string, unknown> }>,
  sourceType: string,
  sourceTitle: string,
  sourceId?: number,
  userNote?: string,
) {
  const results: Array<{ type: string; success: boolean; error?: string }> = []

  for (const s of suggestions) {
    try {
      switch (s.type) {
        case 'link_project': {
          // Link existing entity to a project (update project updated_at + optionally tag)
          const projectId = s.payload.project_id as number | undefined
          if (projectId) {
            await execute(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId])
          }
          results.push({ type: s.type, success: true })
          break
        }

        case 'create_worklog': {
          const title = (s.payload.title as string) || `Werklog: ${sourceTitle.slice(0, 60)}`
          const desc  = userNote || (s.payload.description as string) || ''
          await execute(
            `INSERT INTO work_logs (title, description, log_date, created_at) VALUES ($1, $2, CURRENT_DATE, NOW())`,
            [title, desc]
          )
          results.push({ type: s.type, success: true })
          break
        }

        case 'create_note': {
          const title = (s.payload.title as string) || `Notitie: ${sourceTitle.slice(0, 60)}`
          const body  = userNote || (s.payload.content as string) || ''
          await execute(
            `INSERT INTO notes (title, content, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
            [title, body]
          )
          results.push({ type: s.type, success: true })
          break
        }

        case 'create_todo': {
          const title = (s.payload.title as string) || sourceTitle.slice(0, 80)
          await execute(
            `INSERT INTO todos (title, priority, category, completed, created_at) VALUES ($1, 'medium', 'overig', 0, NOW())`,
            [title]
          )
          results.push({ type: s.type, success: true })
          break
        }

        case 'create_idea': {
          const title = (s.payload.title as string) || sourceTitle.slice(0, 80)
          const desc  = userNote || (s.payload.description as string) || ''
          await execute(
            `INSERT INTO ideas (title, description, status, created_at, updated_at) VALUES ($1, $2, 'nieuw', NOW(), NOW())`,
            [title, desc]
          )
          results.push({ type: s.type, success: true })
          break
        }

        case 'update_memory': {
          const key   = ((s.payload.key as string) || `context_${sourceType}`).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 60)
          const value = userNote || (s.payload.value as string) || sourceTitle
          const existing = await queryOne<{ id: number }>('SELECT id FROM memory_log WHERE key = $1', [key])
          if (existing?.id) {
            await execute(`UPDATE memory_log SET value = $2, last_reinforced_at = NOW() WHERE id = $1`, [existing.id, value])
          } else {
            await execute(`INSERT INTO memory_log (key, value, created_at, last_reinforced_at) VALUES ($1, $2, NOW(), NOW())`, [key, value])
          }
          results.push({ type: s.type, success: true })
          break
        }

        default:
          results.push({ type: s.type, success: true })
      }
    } catch (err) {
      results.push({ type: s.type, success: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.type || !body?.title) {
    return NextResponse.json({ error: 'type en title zijn verplicht' }, { status: 400 })
  }

  const { type, title, content, id, execute: doExecute, selectedSuggestions, userNote } = body

  if (doExecute) {
    if (!Array.isArray(selectedSuggestions)) {
      return NextResponse.json({ error: 'selectedSuggestions moet een array zijn' }, { status: 400 })
    }
    const results = await executeSuggestions(selectedSuggestions, type, title, id, userNote)
    const allOk = results.every(r => r.success)
    return NextResponse.json({ success: allOk, results })
  }

  // Analysis mode
  const analysis = await analyseItem(type, title, content)
  return NextResponse.json(analysis)
}
