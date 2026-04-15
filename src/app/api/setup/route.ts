export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { initSchema } from '@/lib/db'

export async function POST(request: NextRequest) {
  const key = request.headers.get('x-api-key')
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await initSchema()
  return NextResponse.json({ success: true, message: 'Schema aangemaakt' })
}
