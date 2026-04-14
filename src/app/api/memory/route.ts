import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'

export async function GET() {
  const memories = await query(`SELECT * FROM memory_log ORDER BY last_reinforced_at DESC`)
  return NextResponse.json({ memories })
}

export async function POST(request: NextRequest) {
  const { key, value, category, confidence } = await request.json()
  if (!key || !value) return NextResponse.json({ error: 'key en value zijn verplicht' }, { status: 400 })
  await execute(`
    INSERT INTO memory_log (key, value, category, confidence) VALUES ($1, $2, $3, $4)
    ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, confidence = EXCLUDED.confidence, last_reinforced_at = NOW(), updated_at = NOW()
  `, [key, value, category ?? 'general', confidence ?? 0.8])
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json()
  await execute(`DELETE FROM memory_log WHERE id = $1`, [id])
  return NextResponse.json({ success: true })
}
