export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getHealthToday, upsertHealthLog } from '@/lib/data-service'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7')
    const [today, history] = await Promise.all([
      getHealthToday(),
      query(`SELECT * FROM health_logs ORDER BY log_date DESC LIMIT $1`, [days]),
    ])
    return NextResponse.json({ data: { today, history } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await upsertHealthLog(body)
    const today = await getHealthToday()
    return NextResponse.json({ data: today })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
