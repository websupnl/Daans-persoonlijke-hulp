/**
 * Import Segmentation Engine
 *
 * Gebruikt GPT-4o om een genormaliseerde tekst op te splitsen in
 * betekenisvolle items, elk met type, module, confidence en temporaliteit.
 *
 * Pipeline:
 * 1. Laad context (bestaande projecten, memory keys)
 * 2. Split tekst in chunks als > 3000 chars
 * 3. Per chunk: GPT-4o prompt → array van RawSegment
 * 4. Dedup chunks (zelfde source_excerpt)
 * 5. Sla candidates op in DB
 * 6. Genereer follow-up vragen
 */

import { getOpenAIClient } from '@/lib/ai/openai-client'
import { execute, query, queryOne } from '@/lib/db'
import { chunkText } from './normalizer'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateType =
  | 'project'
  | 'memory'
  | 'idea'
  | 'todo'
  | 'journal'
  | 'worklog'
  | 'contact'
  | 'event'
  | 'ignore'

export type TemporalContext = 'current' | 'historical' | 'future_plan' | 'uncertain'
export type SuggestedAction = 'create' | 'merge' | 'update' | 'ignore'

export interface RawSegment {
  source_excerpt: string
  normalized_text: string
  candidate_type: CandidateType
  target_module: string
  confidence: number
  temporal_context: TemporalContext
  suggested_title?: string
  ai_reasoning: string
  suggested_action: SuggestedAction
}

interface SegmentationResult {
  segments: RawSegment[]
  follow_up_questions: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Context loader
// ─────────────────────────────────────────────────────────────────────────────

async function loadExistingContext(): Promise<{
  projects: Array<{ id: number; title: string }>
  memoryKeys: string[]
  ideaTitles: string[]
}> {
  const [projects, memoryRows, ideaRows] = await Promise.all([
    query<{ id: number; title: string }>(
      `SELECT id, title FROM projects WHERE status != 'afgerond' ORDER BY updated_at DESC LIMIT 30`
    ).catch(() => [] as Array<{ id: number; title: string }>),
    query<{ key: string }>(
      `SELECT key FROM memory_log ORDER BY last_reinforced_at DESC LIMIT 50`
    ).catch(() => [] as Array<{ key: string }>),
    query<{ title: string }>(
      `SELECT title FROM ideas ORDER BY created_at DESC LIMIT 30`
    ).catch(() => [] as Array<{ title: string }>),
  ])

  return {
    projects,
    memoryKeys: memoryRows.map(r => r.key),
    ideaTitles: ideaRows.map(r => r.title),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GPT-4o segmentation
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(context: Awaited<ReturnType<typeof loadExistingContext>>): string {
  const today = new Date().toISOString().split('T')[0]
  const projectList = context.projects.map(p => `- ${p.title} (ID: ${p.id})`).join('\n')
  const memoryList = context.memoryKeys.slice(0, 20).join(', ')
  const ideaList = context.ideaTitles.slice(0, 10).join(', ')

  return `Je bent een import-analyse AI voor Daan's persoonlijke levens-OS.

Vandaag: ${today}
Daan is: ondernemer (WebsUp.nl), elektricien (Bouma), bouwt persoonlijke AI-app.

BESTAANDE PROJECTEN:
${projectList || '(geen)'}

BEKENDE MEMORY KEYS:
${memoryList || '(geen)'}

BEKENDE IDEEËN:
${ideaList || '(geen)'}

JOUW TAAK:
Analyseer de tekst en splits deze op in losse betekenisvolle items.
Elk item is iets wat ergens thuishoort in Daan's systeem.

CANDIDATE TYPES EN WANNEER:
- project: "werkt aan X", "X loopt nog", "X project", bedrijfsnamen/projectnamen
- memory: feiten over Daan ("ik ben X", "mijn X is Y", voorkeuren, situatie)
- idea: "wil X bouwen/starten", plannen voor nieuwe dingen, business ideeën
- todo: "moet X doen", "X afmaken", taken en to-do items
- journal: gevoelens, reflecties, ervaringen ("voelde me X", "motivatie X", dagboek-achtig)
- worklog: gewerkte uren, wat er gedaan is op een dag ("X uur gewerkt aan Y")
- contact: namen van personen/bedrijven met context
- event: afspraken, meetings, deadlines
- ignore: groeten, bevestigingen, meta-tekst zonder inhoud

TEMPORAL CONTEXT:
- current: nu actief, huidig feit
- historical: was zo in het verleden, mogelijk verouderd
- future_plan: intentie, wens, plan voor de toekomst
- uncertain: onduidelijk wanneer of of dit nog klopt

REGELS:
1. Combineer gerelateerde zinnen tot één item — maak geen micro-fragmenten
2. Geef confidence 0.0-1.0 (hoe zeker ben je van de classificatie)
3. Splits NIET op als één zin al het hele item dekt
4. Markeer gevoelige persoonlijke items (emoties, gezondheid) als journal
5. Als iets zowel memory als idea is → kies het meest specifieke
6. Bekende projectnamen → altijd als project, zelfs zonder werkwoord
7. Max ~20 items per chunk — samenvouwen wat logisch bij elkaar hoort

OUTPUT: Alleen JSON, geen uitleg erbuiten.
{
  "segments": [
    {
      "source_excerpt": "exact citaat uit de tekst",
      "normalized_text": "schone samenvatting in 1-2 zinnen",
      "candidate_type": "project|memory|idea|todo|journal|worklog|contact|event|ignore",
      "target_module": "projects|memory_log|ideas|todos|journal_entries|work_logs|contacts|events",
      "confidence": 0.0-1.0,
      "temporal_context": "current|historical|future_plan|uncertain",
      "suggested_title": "Korte naam (max 5 woorden)",
      "ai_reasoning": "Waarom deze classificatie",
      "suggested_action": "create|merge|update|ignore"
    }
  ],
  "follow_up_questions": ["vraag 1", "vraag 2"]
}`
}

async function segmentChunk(
  chunk: string,
  systemPrompt: string,
  chunkIndex: number
): Promise<SegmentationResult> {
  const client = getOpenAIClient()

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 4000,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyseer deze tekst en retourneer de JSON:\n\n---\n${chunk}\n---`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content ?? '{}'

  try {
    const parsed = JSON.parse(raw)
    const segments: RawSegment[] = (parsed.segments ?? [])
      .filter((s: any) => s?.source_excerpt && s?.candidate_type && s?.candidate_type !== 'ignore')
      .map((s: any) => ({
        source_excerpt: String(s.source_excerpt ?? '').slice(0, 500),
        normalized_text: String(s.normalized_text ?? s.source_excerpt ?? '').slice(0, 1000),
        candidate_type: s.candidate_type as CandidateType,
        target_module: s.target_module ?? typeToModule(s.candidate_type),
        confidence: Math.min(1, Math.max(0, Number(s.confidence ?? 0.5))),
        temporal_context: (s.temporal_context ?? 'current') as TemporalContext,
        suggested_title: s.suggested_title ? String(s.suggested_title).slice(0, 100) : undefined,
        ai_reasoning: String(s.ai_reasoning ?? '').slice(0, 300),
        suggested_action: (s.suggested_action ?? 'create') as SuggestedAction,
      }))

    return {
      segments,
      follow_up_questions: (parsed.follow_up_questions ?? []).slice(0, 5).map(String),
    }
  } catch (err) {
    console.error(`[Segmentation] Chunk ${chunkIndex} parse error:`, err)
    return { segments: [], follow_up_questions: [] }
  }
}

function typeToModule(type: string): string {
  const map: Record<string, string> = {
    project: 'projects',
    memory: 'memory_log',
    idea: 'ideas',
    todo: 'todos',
    journal: 'journal_entries',
    worklog: 'work_logs',
    contact: 'contacts',
    event: 'events',
  }
  return map[type] ?? 'inbox_items'
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduplication
// ─────────────────────────────────────────────────────────────────────────────

function deduplicateSegments(segments: RawSegment[]): RawSegment[] {
  const seen = new Set<string>()
  return segments.filter(s => {
    // Normalize key: lowercase excerpt, first 80 chars
    const key = s.source_excerpt.toLowerCase().trim().slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: run full segmentation for an import run
// ─────────────────────────────────────────────────────────────────────────────

export async function runSegmentation(runId: number): Promise<{
  candidateCount: number
  followUpCount: number
}> {
  // Load the run
  const run = await queryOne<{ id: number; normalized_input: string | null; raw_input: string }>(
    'SELECT id, normalized_input, raw_input FROM import_runs WHERE id = $1',
    [runId]
  )
  if (!run) throw new Error(`Import run ${runId} not found`)

  const text = run.normalized_input ?? run.raw_input
  if (!text?.trim()) throw new Error('Import run has no text to segment')

  // Update status
  await execute(
    `UPDATE import_runs SET status = 'segmenting' WHERE id = $1`,
    [runId]
  )

  // Load context
  const context = await loadExistingContext()
  const systemPrompt = buildSystemPrompt(context)

  // Chunk text
  const chunks = chunkText(text)
  console.log(`[Segmentation] Run ${runId}: ${chunks.length} chunk(s), ${text.length} chars`)

  // Segment each chunk
  const allSegments: RawSegment[] = []
  const allFollowUps: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    const result = await segmentChunk(chunks[i], systemPrompt, i)
    allSegments.push(...result.segments)
    allFollowUps.push(...result.follow_up_questions)
  }

  // Deduplicate
  const unique = deduplicateSegments(allSegments)
  console.log(`[Segmentation] Run ${runId}: ${allSegments.length} raw → ${unique.length} unique segments`)

  // Write candidates to DB
  let position = 0
  for (const seg of unique) {
    await execute(
      `INSERT INTO import_candidates
        (import_run_id, source_excerpt, source_position, candidate_type, target_module,
         confidence, temporal_context, normalized_text, suggested_title, ai_reasoning, suggested_action)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        runId,
        seg.source_excerpt,
        position++,
        seg.candidate_type,
        seg.target_module,
        seg.confidence,
        seg.temporal_context,
        seg.normalized_text,
        seg.suggested_title ?? null,
        seg.ai_reasoning,
        seg.suggested_action,
      ]
    )
  }

  // Deduplicate follow-up questions and write
  const uniqueFollowUps = Array.from(new Set(allFollowUps)).slice(0, 5)
  for (const question of uniqueFollowUps) {
    await execute(
      `INSERT INTO import_followups (import_run_id, question) VALUES ($1, $2)`,
      [runId, question]
    )
  }

  // Update run stats
  await execute(
    `UPDATE import_runs SET
       status = 'review',
       total_candidates = $2
     WHERE id = $1`,
    [runId, unique.length]
  )

  return { candidateCount: unique.length, followUpCount: uniqueFollowUps.length }
}
