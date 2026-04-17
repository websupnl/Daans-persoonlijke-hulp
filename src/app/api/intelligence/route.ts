import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [theories, questions] = await Promise.all([
      query(`
        SELECT id, category, theory, confidence, status, impact_score, 
               source_modules, TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI') as updated_at
        FROM ai_theories
        WHERE status IN ('hypothesis', 'confirmed')
        ORDER BY last_updated DESC LIMIT 10
      `),
      query(`
        SELECT id, source_module, question, rationale, status, priority, 
               TO_CHAR(created_at, 'YYYY-MM-DD') as created_at
        FROM pending_questions
        WHERE status IN ('pending', 'sent')
        ORDER BY priority DESC, created_at DESC LIMIT 5
      `)
    ])

    return NextResponse.json({
      theories,
      questions
    })
  } catch (err) {
    console.error('[Intelligence API] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
