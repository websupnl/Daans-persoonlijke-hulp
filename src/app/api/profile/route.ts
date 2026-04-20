export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile, setUserFact, deleteUserFact } from '@/lib/data-service'

export async function GET() {
  try {
    const profile = await getUserProfile()
    return NextResponse.json({ data: profile })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { label, value, type, category, confidence, source } = await req.json()
    if (!label || !value) return NextResponse.json({ error: 'label en value verplicht' }, { status: 400 })
    await setUserFact(label, value, { type, category, confidence, source })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const label = searchParams.get('label')
    if (!label) return NextResponse.json({ error: 'label verplicht' }, { status: 400 })
    await deleteUserFact(label)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
