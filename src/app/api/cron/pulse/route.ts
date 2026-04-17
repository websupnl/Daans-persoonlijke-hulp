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
import { queryOne, query, execute } from '@/lib/db'
import {
  collectDailyObservations,
  runDailyPatternAnalysis,
  runWeeklyPatternAnalysis
} from '@/lib/ai/pattern-engine'
import { sendTelegramMessage } from '@/lib/telegram/send-message'

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

  // 1. Collect daily observations (hourly update)
  try {
    await collectDailyObservations()
    results.observations = { updated: true }
  } catch (err) {
    console.error('[Pulse] Observation error:', err)
    results.observations = { error: err instanceof Error ? err.message : 'unknown' }
  }

  // 2. Run the proactive engine
  try {
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

  // 3. Daily Pattern Analysis (once a day)
  try {
    const lastDaily = await queryOne<{ last_date: string }>(`
      SELECT TO_CHAR(MAX(created_at), 'YYYY-MM-DD') as last_date 
      FROM ai_theories WHERE category != 'wekelijks_inzicht'
    `)
    const today = new Date().toISOString().slice(0, 10)
    
    if (lastDaily?.last_date !== today) {
      const dailyRes = await runDailyPatternAnalysis()
      results.dailyAnalysis = dailyRes
    }
  } catch (err) {
    console.error('[Pulse] Daily analysis error:', err)
  }

  // 4. Weekly Pattern Analysis (once a week, Sunday)
  try {
    const isSunday = new Date().getDay() === 0
    const lastWeekly = await queryOne<{ last_date: string }>(`
      SELECT TO_CHAR(MAX(created_at), 'YYYY-MM-DD') as last_date 
      FROM ai_theories WHERE category = 'wekelijks_inzicht'
    `)
    const weekAgo = new Date(Date.now() - 6 * 24 * 3600000).toISOString().slice(0, 10)

    if (isSunday && (!lastWeekly?.last_date || lastWeekly.last_date < weekAgo)) {
      const weeklyRes = await runWeeklyPatternAnalysis()
      results.weeklyAnalysis = weeklyRes
    }
  } catch (err) {
    console.error('[Pulse] Weekly analysis error:', err)
  }

  // 5. Send Pending Question (if no proactive message was sent and we have a high-prio question)
  if (!results.proactive || !(results.proactive as any).telegramSent) {
    try {
      const pendingQ = await queryOne<{ id: number; question: string; rationale: string; source_module: string }>(`
        SELECT id, question, rationale, source_module FROM pending_questions
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at DESC LIMIT 1
      `)

      const chatId = process.env.TELEGRAM_CHAT_ID
      if (pendingQ && chatId) {
        await sendTelegramMessage(chatId, `🧠 *Pattern Brain Vraag*\n\n${pendingQ.question}`, {
          reply_markup: {
            inline_keyboard: [[
              { text: '📔 Beantwoord', callback_data: `pattern_q_reply:${pendingQ.id}` },
              { text: '⏩ Sla over', callback_data: `pattern_q_dismiss:${pendingQ.id}` },
            ]]
          }
        })
        await execute(`UPDATE pending_questions SET status = 'sent', sent_at = NOW() WHERE id = $1`, [pendingQ.id])
        results.questionSent = { id: pendingQ.id }
      }
    } catch (err) {
      console.error('[Pulse] Question delivery error:', err)
    }
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
