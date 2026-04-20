export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { getHealthToday, upsertHealthLog } from '@/lib/data-service'
import { query } from '@/lib/db'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '7')
    const [today, history] = await Promise.all([
      getHealthToday(),
      query(`SELECT * FROM health_logs ORDER BY log_date DESC LIMIT $1`, [days]),
    ])
    return jsonOk({ today, history }, undefined, req)
  } catch (error: any) {
    return jsonFail('HEALTH_GET_FAILED', error.message || 'Kon health data niet ophalen', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await upsertHealthLog(body)
    const today = await getHealthToday()
    return jsonOk(today, undefined, req)
  } catch (error: any) {
    return jsonFail('HEALTH_POST_FAILED', error.message || 'Kon health log niet opslaan', 500, error, req)
  }
}
