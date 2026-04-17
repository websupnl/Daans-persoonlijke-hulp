import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'
import { runDailyPatternAnalysis, collectDailyObservations } from '@/lib/ai/pattern-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [patterns, questions, observations] = await Promise.all([
      query(`
        SELECT id, category, theory, confidence, status, impact_score, 
               source_modules, action_potential, supporting_data,
               TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI') as updated_at
        FROM ai_theories
        ORDER BY status = 'confirmed' DESC, impact_score DESC, last_updated DESC
      `),
      query(`
        SELECT id, source_module, theory_id, question, rationale, status, priority, confidence, impact_score,
               TO_CHAR(created_at, 'YYYY-MM-DD') as created_at
        FROM pending_questions
        WHERE status != 'dismissed'
        ORDER BY status = 'pending' DESC, priority DESC, created_at DESC
      `),
      query(`
        SELECT obs_date, module, metric_key, metric_value, metric_text
        FROM pattern_observations
        WHERE obs_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY obs_date ASC
      `)
    ])

    return NextResponse.json({
      patterns: patterns.map(p => ({
        ...p,
        source_modules: typeof p.source_modules === 'string' ? JSON.parse(p.source_modules) : p.source_modules
      })),
      questions,
      observations
    })
  } catch (err) {
    console.error('[Patterns API] Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'analyze') {
      await collectDailyObservations()
      const result = await runDailyPatternAnalysis()
      return NextResponse.json({ success: true, result })
    }

    if (action === 'confirm' || action === 'dismiss') {
      const { id } = body
      const status = action === 'confirm' ? 'confirmed' : 'dismissed'
      await execute(`UPDATE ai_theories SET status = $1, last_updated = NOW() WHERE id = $2`, [status, id])
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('[Patterns API] POST Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
