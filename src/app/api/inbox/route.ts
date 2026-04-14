import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET() {
  const db = getDb()
  const items = db.prepare(`SELECT * FROM inbox_items ORDER BY created_at DESC LIMIT 50`).all()
  const pending = db.prepare(`SELECT COUNT(*) as count FROM inbox_items WHERE parsed_status = 'pending'`).get() as { count: number }
  return NextResponse.json({ items, pendingCount: pending.count })
}

export async function POST(request: NextRequest) {
  const db = getDb()
  const { raw_text, suggested_type, suggested_context } = await request.json()
  if (!raw_text) return NextResponse.json({ error: 'raw_text is verplicht' }, { status: 400 })
  const result = db.prepare(`INSERT INTO inbox_items (raw_text, suggested_type, suggested_context) VALUES (?, ?, ?)`).run(raw_text, suggested_type ?? null, suggested_context ?? null)
  const item = db.prepare(`SELECT * FROM inbox_items WHERE id = ?`).get(result.lastInsertRowid)
  return NextResponse.json({ item }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const db = getDb()
  const { id, parsed_status } = await request.json()
  db.prepare(`UPDATE inbox_items SET parsed_status = ?, processed_at = CASE WHEN ? = 'processed' THEN datetime('now') ELSE NULL END WHERE id = ?`).run(parsed_status, parsed_status, id)
  return NextResponse.json({ success: true })
}
