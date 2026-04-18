export const dynamic = 'force-dynamic'

/**
 * POST /api/import
 * Maak een nieuwe import run aan, normaliseer de input, sla op in DB.
 * Geeft runId terug zodat de client segmentatie kan triggeren.
 *
 * Body (JSON):
 *   { rawInput: string, filename?: string }
 * OF multipart/form-data:
 *   file: File
 */

import { NextRequest, NextResponse } from 'next/server'
import { execute, queryOne } from '@/lib/db'
import { normalizeText } from '@/lib/import/normalizer'

export async function POST(req: NextRequest) {
  let rawInput = ''
  let filename: string | undefined

  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    rawInput = await file.text()
    filename = file.name
  } else {
    const body = await req.json().catch(() => null)
    if (!body?.rawInput) return NextResponse.json({ error: 'rawInput ontbreekt' }, { status: 400 })
    rawInput = String(body.rawInput)
    filename = body.filename ?? undefined
  }

  if (!rawInput.trim()) return NextResponse.json({ error: 'Lege input' }, { status: 400 })
  if (rawInput.length > 500_000) return NextResponse.json({ error: 'Input te groot (max 500KB)' }, { status: 413 })

  const normalized = normalizeText(rawInput, filename)

  const run = await queryOne<{ id: number }>(
    `INSERT INTO import_runs
       (raw_input, normalized_input, source_type, source_label, status, created_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW())
     RETURNING id`,
    [
      rawInput.slice(0, 200_000),
      normalized.normalized,
      normalized.sourceType,
      normalized.sourceLabel,
    ]
  )

  if (!run?.id) return NextResponse.json({ error: 'Run kon niet worden aangemaakt' }, { status: 500 })

  return NextResponse.json({
    runId: run.id,
    sourceType: normalized.sourceType,
    sourceLabel: normalized.sourceLabel,
    detectedFormat: normalized.detectedFormat,
    normalizedLength: normalized.normalized.length,
    rawLength: normalized.rawLength,
  })
}

export async function GET() {
  const { query } = await import('@/lib/db')
  const runs = await query<{
    id: number
    source_label: string
    source_type: string
    status: string
    total_candidates: number | null
    accepted_count: number | null
    created_at: string
    completed_at: string | null
  }>(
    `SELECT id, source_label, source_type, status, total_candidates, accepted_count, created_at, completed_at
     FROM import_runs
     ORDER BY created_at DESC
     LIMIT 50`
  ).catch(() => [])

  return NextResponse.json({ runs })
}
