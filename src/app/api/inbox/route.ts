import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'

export async function GET() {
  const items = await query(`SELECT * FROM inbox_items ORDER BY created_at DESC LIMIT 50`)
  const pending = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM inbox_items WHERE parsed_status = 'pending'`)
  return NextResponse.json({ items, pendingCount: pending?.count ?? 0 })
}

export async function POST(request: NextRequest) {
  const { raw_text, suggested_type, suggested_context } = await request.json()
  if (!raw_text) return NextResponse.json({ error: 'raw_text is verplicht' }, { status: 400 })
  const item = await queryOne(`
    INSERT INTO inbox_items (raw_text, suggested_type, suggested_context) VALUES ($1, $2, $3) RETURNING *
  `, [raw_text, suggested_type ?? null, suggested_context ?? null])
  return NextResponse.json({ item }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const { id, parsed_status } = await request.json()
  await execute(
    `UPDATE inbox_items SET parsed_status = $1, processed_at = CASE WHEN $2 = 'processed' THEN NOW() ELSE NULL END WHERE id = $3`,
    [parsed_status, parsed_status, id]
  )
  return NextResponse.json({ success: true })
}
