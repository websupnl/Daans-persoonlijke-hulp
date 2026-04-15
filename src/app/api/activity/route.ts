export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const entityType = searchParams.get('entity_type')

  let sql = `SELECT * FROM activity_log WHERE 1=1`
  const params: unknown[] = []
  let i = 1

  if (entityType) {
    sql += ` AND entity_type = $${i++}`
    params.push(entityType)
  }

  sql += ` ORDER BY created_at DESC LIMIT $${i++}`
  params.push(limit)

  const items = await query<Record<string, unknown>>(sql, params)
  return NextResponse.json({
    data: items.map((item) => ({
      ...item,
      metadata: JSON.parse(String(item.metadata || '{}')),
    })),
  })
}
