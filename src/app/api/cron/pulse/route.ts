export const dynamic = 'force-dynamic'

/**
 * Hourly Contextual Pulse — Proactive Intelligence Cron Job
 *
 * Called every hour by Vercel Cron.
 * Runs the Proactive Engine: Tier 1 Sentry detects anomalies,
 * Tier 2 Sage crafts a Telegram message if warranted.
 *
 * Also (every 6 hours) updates AI theories about long-term patterns.
 *
 * Secured via CRON_SECRET header set by Vercel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runProactiveEngine } from '@/lib/ai/proactive-engine'
import { updateAITheories } from '@/lib/ai/diary-personas'
import { queryOne } from '@/lib/db'

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  // Block only if auth header is present but wrong (wrong cron secret)
  // Browser/dashboard requests have no auth header → allowed
  if (cronSecret && authHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const results: Record<string, unknown> = {}

  try {
    // Run the proactive engine
    const proactiveResult = await runProactiveEngine()
    results.proactive = {
      triggered: proactiveResult.triggered,
      tier: proactiveResult.tier,
      anomalyCount: proactiveResult.anomalies.length,
      telegramSent: proactiveResult.telegramSent,
      anomalies: proactiveResult.anomalies.map(a => `[${a.severity}] ${a.type}: ${a.detail}`),
    }
  } catch (err) {
    console.error('[Pulse] Proactive engine error:', err instanceof Error ? err.message : err)
    results.proactive = { error: err instanceof Error ? err.message : 'unknown error' }
  }

  // Update AI theories every 6 hours (check last update time)
  try {
    const lastTheoryUpdate = await queryOne<{ last_updated: string }>(`
      SELECT MAX(last_updated) as last_updated FROM ai_theories
    `)
    const hoursSinceTheoryUpdate = lastTheoryUpdate?.last_updated
      ? (Date.now() - new Date(lastTheoryUpdate.last_updated).getTime()) / 3600000
      : 999

    if (hoursSinceTheoryUpdate >= 6) {
      await updateAITheories()
      results.theories = { updated: true, hoursSinceLast: Math.round(hoursSinceTheoryUpdate) }
    } else {
      results.theories = { updated: false, hoursSinceLast: Math.round(hoursSinceTheoryUpdate) }
    }
  } catch (err) {
    console.error('[Pulse] Theory update error:', err instanceof Error ? err.message : err)
    results.theories = { error: err instanceof Error ? err.message : 'unknown error' }
  }

  const duration = Date.now() - startedAt
  console.log(`[Pulse] Completed in ${duration}ms:`, JSON.stringify(results))

  return NextResponse.json({
    ok: true,
    duration,
    timestamp: new Date().toISOString(),
    results,
  })
}
