import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET() {
  const db = getDb()
  const memories = db.prepare(`SELECT * FROM memory_log ORDER BY last_reinforced_at DESC`).all()
  return NextResponse.json({ memories })
}

export async function POST(request: NextRequest) {
  const db = getDb()
  const { key, value, category, confidence } = await request.json()
  if (!key || !value) return NextResponse.json({ error: 'key en value zijn verplicht' }, { status: 400 })
  db.prepare(`
    INSERT INTO memory_log (key, value, category, confidence) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, confidence = excluded.confidence, last_reinforced_at = datetime('now'), updated_at = datetime('now')
  `).run(key, value, category ?? 'general', confidence ?? 0.8)
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const db = getDb()
  const { id } = await request.json()
  db.prepare(`DELETE FROM memory_log WHERE id = ?`).run(id)
  return NextResponse.json({ success: true })
}
