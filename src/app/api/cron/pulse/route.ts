export const dynamic = 'force-dynamic'

/**
 * Hourly Contextual Pulse — Proactive Intelligence Cron Job
 *
 * Called every hour by Vercel Cron.
 *
 * Schedule per hour (Amsterdam time):
 *  03:00 — Nightly memory crawl (cross-module)
 *  08:00 — Morning Briefing (priority, finance, yesterday, focus)
 *  08-23 — Proactive engine → pending question → rotated fallback
 *
 * Fallback rotation (amsterdamHour % 3):
 *  0 → Theory insight (ai_theories)
 *  1 → Absence signal (pure JS detection)
 *  2 → Deep reflection question (LLM)
 *
 * Secured via CRON_SECRET header set by Vercel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runProactiveEngine, generateDeepQuestion, runMorningBriefing } from '@/lib/ai/proactive-engine'
import { updateAITheories } from '@/lib/ai/diary-personas'
import { getSessionFromRequest } from '@/lib/auth/request-session'
import { queryOne, query, execute } from '@/lib/db'
import {
  collectDailyObservations,
  runDailyPatternAnalysis,
  runWeeklyPatternAnalysis,
  detectAbsenceSignals,
} from '@/lib/ai/pattern-engine'
import { sendTelegramMessage } from '@/lib/telegram/send-message'
import { generateMemories } from '@/lib/ai/memory-crawler'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const hasValidCronSecret = !!(cronSecret && authHeader === `Bearer ${cronSecret}`)
  const session = hasValidCronSecret ? null : await getSessionFromRequest(request, { touch: true })
  if (!hasValidCronSecret && !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const results: Record<string, unknown> = {}

  const amsterdamHour = parseInt(
    new Date().toLocaleString('en-US', {
      timeZone: 'Europe/Amsterdam',
      hour: 'numeric',
      hour12: false,
    }),
    10
  )

  // ── 0. Nightly memory crawl at 03:00 ─────────────────────────────────────
  if (amsterdamHour === 3) {
    try {
      const memResult = await generateMemories()
      results.memoryCrawl = memResult
    } catch (err) {
      console.error('[Pulse] Memory crawl error:', err)
      results.memoryCrawl = { error: err instanceof Error ? err.message : 'unknown' }
    }
  }

  // ── 1. Collect daily observations (hourly update) ─────────────────────────
  try {
    await collectDailyObservations()
    results.observations = { updated: true }
  } catch (err) {
    console.error('[Pulse] Observation error:', err)
    results.observations = { error: err instanceof Error ? err.message : 'unknown' }
  }

  // ── 2. Morning Briefing at 08:00 ─────────────────────────────────────────
  if (amsterdamHour === 8) {
    try {
      const sent = await runMorningBriefing()
      results.morningBriefing = { sent }
      if (sent) {
        // Skip all other Telegram messages this hour
        const duration = Date.now() - startedAt
        return NextResponse.json({
          ok: true,
          status: 'morning_briefing_sent',
          duration,
          timestamp: new Date().toISOString(),
          results,
        })
      }
    } catch (err) {
      console.error('[Pulse] Morning briefing error:', err)
      results.morningBriefing = { error: err instanceof Error ? err.message : 'unknown' }
    }
  }

  // ── 3. Run the proactive engine ───────────────────────────────────────────
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

  // ── 4. Daily Pattern Analysis (once a day) ────────────────────────────────
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

  // ── 5. Weekly Pattern Analysis (once a week, Sunday) ─────────────────────
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

  // Track whether a Telegram message has been sent this cycle
  const proactiveSent = (results.proactive as any)?.telegramSent === true
  let messageSent = proactiveSent

  // ── 6. Pending Question (high priority, if nothing sent yet) ─────────────
  if (!messageSent && amsterdamHour >= 8 && amsterdamHour < 23) {
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
            ]],
          },
        })
        await execute(`UPDATE pending_questions SET status = 'sent', sent_at = NOW() WHERE id = $1`, [pendingQ.id])
        results.questionSent = { id: pendingQ.id }
        messageSent = true
      }
    } catch (err) {
      console.error('[Pulse] Question delivery error:', err)
    }
  }

  // ── 7. Diversified fallback hourly message (daytime only) ─────────────────
  // Rotation: hour % 3 → 0=theory, 1=absence, 2=deep reflection
  if (!messageSent && amsterdamHour >= 8 && amsterdamHour < 23) {
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (chatId) {
      const rotationMode = amsterdamHour % 3

      try {
        if (rotationMode === 0) {
          // Mode C: Share a theory/insight from ai_theories
          const theory = await queryOne<{ category: string; theory: string; confidence: number; action_potential: string | null }>(`
            SELECT category, theory, confidence::float, action_potential
            FROM ai_theories
            WHERE status IN ('hypothesis','confirmed')
              AND category != 'wekelijks_inzicht'
            ORDER BY RANDOM() LIMIT 1
          `)
          if (theory) {
            const conf = Math.round(theory.confidence * 100)
            const extra = theory.action_potential ? `\n\n💡 _${theory.action_potential}_` : ''
            await sendTelegramMessage(chatId, `🔬 *Brain Inzicht*\n\n${theory.theory}${extra}\n\n_Vertrouwen: ${conf}% · categorie: ${theory.category}_`, {
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Klopt dit?', callback_data: 'theory_confirm' },
                  { text: '❌ Niet van toepassing', callback_data: 'theory_reject' },
                ]],
              },
            })
            results.theoryInsightSent = { category: theory.category }
            messageSent = true
          }
        }

        if (!messageSent && rotationMode === 1) {
          // Mode A: Absence signal
          const absenceSignals = await detectAbsenceSignals()
          if (absenceSignals.length > 0) {
            const signal = absenceSignals[0]
            await sendTelegramMessage(chatId, `🔍 *Brain Opmerking*\n\n${signal.detail}`)
            results.absenceSignalSent = { type: signal.signal }
            messageSent = true
          }
        }

        if (!messageSent) {
          // Mode D: Deep reflection question (fallback for all modes)
          const question = await generateDeepQuestion()
          await sendTelegramMessage(chatId, `🧠 *Brain Pulse*\n\n${question}`, {
            reply_markup: {
              inline_keyboard: [[
                { text: '📔 Beantwoord in dagboek', callback_data: 'journal_start' },
                { text: '💬 Stuur antwoord hier', callback_data: 'reply_here' },
              ]],
            },
          })
          results.deepQuestionSent = { sent: true }
          messageSent = true
        }
      } catch (err) {
        console.error('[Pulse] Fallback hourly message error:', err)
      }
    }
  }

  // ── 8. Update AI theories every 6 hours ──────────────────────────────────
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
  console.log(`[Pulse] Completed in ${duration}ms | hour=${amsterdamHour} | sent=${messageSent}`)

  return NextResponse.json({
    ok: true,
    status: messageSent ? 'message_sent' : 'silent',
    duration,
    timestamp: new Date().toISOString(),
    results,
  })
}
