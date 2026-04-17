export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const completed = searchParams.get('completed')

  const conditions: string[] = []
  const params: unknown[] = []

  if (completed === '1') {
    conditions.push('completed = 1')
  } else if (completed === '0') {
    conditions.push('completed = 0')
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sql = `
    SELECT *
    FROM groceries
    ${whereClause}
    ORDER BY category ASC, created_at DESC
  `
  const items = await query(sql, params)
  return NextResponse.json({ data: items })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, quantity, category } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
  
  const item = await queryOne(
    `INSERT INTO groceries (title, quantity, category)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [title.trim(), quantity || null, category || 'overig']
  )
  
  if ((item as Record<string, unknown> | undefined)?.id) {
    await logActivity({
      entityType: 'grocery',
      entityId: Number((item as Record<string, unknown>).id),
      action: 'created',
      title: title.trim(),
      summary: 'Boodschap toegevoegd aan lijst',
    })
  }
  
  return NextResponse.json({ data: item }, { status: 201 })
}
