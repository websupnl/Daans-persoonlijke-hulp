export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute, queryOne } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const body = await req.json()

  const fields = ['title', 'raw_input', 'refined_summary', 'verdict', 'score', 'status', 'market_gap', 'next_steps', 'tags']
  const updates: string[] = []
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    if (!(field in body)) continue
    updates.push(`${field} = $${i++}`)
    if (field === 'next_steps' || field === 'tags') {
      values.push(JSON.stringify(body[field] || []))
    } else {
      values.push(body[field] ?? null)
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Geen velden om te updaten' }, { status: 400 })
  }

  updates.push(`updated_at = NOW()`)
  values.push(id)

  await execute(`UPDATE ideas SET ${updates.join(', ')} WHERE id = $${i}`, values)
  const updated = await queryOne<Record<string, unknown>>('SELECT * FROM ideas WHERE id = $1', [id])
  return NextResponse.json({
    data: {
      ...updated,
      next_steps: JSON.parse(String(updated?.next_steps || '[]')),
      tags: JSON.parse(String(updated?.tags || '[]')),
    },
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await execute('DELETE FROM ideas WHERE id = $1', [parseInt(params.id, 10)])
  return NextResponse.json({ success: true })
}
