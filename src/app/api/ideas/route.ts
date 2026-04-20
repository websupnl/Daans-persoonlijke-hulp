export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

interface IdeaAnalysis {
  title: string
  refined_summary: string
  verdict: 'super slim' | 'kansrijk' | 'twijfelachtig' | 'niet waardig' | 'nog beoordelen'
  score: number
  market_gap: string
  next_steps: string[]
  tags: string[]
}

function fallbackAnalysis(input: string): IdeaAnalysis {
  return {
    title: input.slice(0, 60),
    refined_summary: input,
    verdict: 'nog beoordelen',
    score: 0,
    market_gap: 'Nog geen AI-analyse beschikbaar.',
    next_steps: ['Scherp het probleem aan', 'Bepaal doelgroep', 'Test of iemand hiervoor wil betalen'],
    tags: [],
  }
}

async function analyzeIdea(input: string): Promise<IdeaAnalysis> {
  if (!process.env.OPENAI_API_KEY) return fallbackAnalysis(input)

  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Je bent de strategische sparringpartner van Daan. Analyseer een ruw business- of productidee.
Geef alleen geldige JSON terug:
{
  "title": "korte sterke titel",
  "refined_summary": "verbeterde samenvatting in helder Nederlands",
  "verdict": "super slim" | "kansrijk" | "twijfelachtig" | "niet waardig",
  "score": 0-100,
  "market_gap": "korte analyse van probleem/markt/gat",
  "next_steps": ["stap 1", "stap 2", "stap 3"],
  "tags": ["tag1", "tag2", "tag3"]
}
Wees direct, praktisch en realistisch. Geen fluff.`,
      },
      {
        role: 'user',
        content: input,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) return fallbackAnalysis(input)

  try {
    const parsed = JSON.parse(raw) as IdeaAnalysis
    return {
      title: parsed.title || input.slice(0, 60),
      refined_summary: parsed.refined_summary || input,
      verdict: parsed.verdict || 'nog beoordelen',
      score: Number(parsed.score || 0),
      market_gap: parsed.market_gap || 'Geen analyse beschikbaar.',
      next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps.slice(0, 5).map(String) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6).map(String) : [],
    }
  } catch {
    return fallbackAnalysis(input)
  }
}

export async function GET() {
  try {
    const ideas = (await query<Record<string, unknown>>(`
    SELECT * FROM ideas
    ORDER BY
      CASE status
        WHEN 'uitwerken' THEN 0
        WHEN 'valideren' THEN 1
        WHEN 'nieuw' THEN 2
        WHEN 'wachten' THEN 3
        ELSE 4
      END,
      created_at DESC
    `)).map((idea) => ({
      ...idea,
      next_steps: JSON.parse(String(idea.next_steps || '[]')),
      tags: JSON.parse(String(idea.tags || '[]')),
    }))

    return jsonOk(ideas)
  } catch (error: unknown) {
    return jsonFail('IDEAS_LIST_FAILED', 'Kon ideeën niet ophalen', 500, error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rawInput = String(body.raw_input || body.title || '').trim()

    if (!rawInput) {
      return jsonFail('IDEA_VALIDATION', 'Idee tekst is verplicht', 400, undefined, req)
    }

    const analysis = await analyzeIdea(rawInput)
    const row = await queryOne<Record<string, unknown>>(`
    INSERT INTO ideas (title, raw_input, refined_summary, verdict, score, market_gap, next_steps, tags, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    analysis.title,
    rawInput,
    analysis.refined_summary,
    analysis.verdict,
    analysis.score,
    analysis.market_gap,
    JSON.stringify(analysis.next_steps),
    JSON.stringify(analysis.tags),
    body.status || 'nieuw',
  ])

    if (row?.id) {
      await syncEntityLinks({
        sourceType: 'idea',
        sourceId: Number(row.id),
        tags: analysis.tags,
      })
      await logActivity({
        entityType: 'idea',
        entityId: Number(row.id),
        action: 'created',
        title: analysis.title,
        summary: `Idee beoordeeld als ${analysis.verdict}`,
        metadata: { verdict: analysis.verdict, score: analysis.score, status: body.status || 'nieuw' },
      })
    }

    return jsonOk({
      ...row,
      next_steps: JSON.parse(String(row?.next_steps || '[]')),
      tags: JSON.parse(String(row?.tags || '[]')),
    }, { status: 201 }, req)
  } catch (error: unknown) {
    return jsonFail('IDEA_CREATE_FAILED', 'Kon idee niet opslaan', 500, error, req)
  }
}
