export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { generateMemories } from '@/lib/ai/memory-crawler'

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY niet ingesteld' }, { status: 400 })
  }

  try {
    const result = await generateMemories()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[Memory Generate] Error:', err)
    return NextResponse.json({ error: 'Memory generatie mislukt' }, { status: 500 })
  }
}
