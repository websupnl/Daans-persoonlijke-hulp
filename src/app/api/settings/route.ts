export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserSettings, setSetting } from '@/lib/data-service'

export async function GET() {
  try {
    const settings = await getUserSettings()
    return NextResponse.json({ data: settings })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    await Promise.all(
      Object.entries(body).map(([key, value]) => setSetting(key, String(value)))
    )
    const settings = await getUserSettings()
    return NextResponse.json({ data: settings })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
