export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'
import { getUserContext, contextToPrompt } from '@/lib/context-builder'
import { format } from 'date-fns'

export interface Insight {
  type: 'success' | 'warning' | 'error' | 'info'
  text: string
  module: 'habits' | 'todos' | 'finance' | 'journal' | 'general'
  icon: string
}

/** Genereer rule-based insights op basis van gebruikersdata */
function generateRuleBasedInsights(ctx: Awaited<ReturnType<typeof getUserContext>>): Insight[] {
  const insights: Insight[] = []
  const today = format(new Date(), 'yyyy-MM-dd')

  // ── Gewoontes ──
  const undoneHabits = ctx.habits.filter(h => !h.completedToday)
  const doneHabits = ctx.habits.filter(h => h.completedToday)
  const longStreaks = ctx.habits.filter(h => h.streak >= 7)
  const brokenStreaks = ctx.habits.filter(h => h.streak === 0 && !h.completedToday)

  longStreaks.forEach(h => {
    insights.push({
      type: 'success',
      text: `${h.icon} ${h.name}: ${h.streak} dagen streak! 🔥`,
      module: 'habits',
      icon: '🔥',
    })
  })

  if (undoneHabits.length > 0 && ctx.habits.length > 0) {
    const pct = Math.round((doneHabits.length / ctx.habits.length) * 100)
    if (pct < 50) {
      insights.push({
        type: 'warning',
        text: `${undoneHabits.length} gewoonte${undoneHabits.length > 1 ? 's' : ''} nog te doen: ${undoneHabits.map(h => h.name).join(', ')}`,
        module: 'habits',
        icon: '⚡',
      })
    }
  }

  // ── Todos ──
  const overdueTodos = ctx.openTodos.filter(t => t.due_date && t.due_date < today)
  const todayTodos = ctx.openTodos.filter(t => t.due_date === today)
  const highPrio = ctx.openTodos.filter(t => t.priority === 'hoog')

  if (overdueTodos.length > 0) {
    insights.push({
      type: 'error',
      text: `${overdueTodos.length} te late ${overdueTodos.length === 1 ? 'taak' : 'taken'}: ${overdueTodos.slice(0, 2).map(t => `"${t.title}"`).join(', ')}`,
      module: 'todos',
      icon: '⚠️',
    })
  }

  if (todayTodos.length > 0) {
    insights.push({
      type: 'info',
      text: `${todayTodos.length} ${todayTodos.length === 1 ? 'taak' : 'taken'} gepland voor vandaag`,
      module: 'todos',
      icon: '📋',
    })
  }

  if (highPrio.length > 0 && overdueTodos.length === 0) {
    insights.push({
      type: 'warning',
      text: `${highPrio.length} hoog-prioriteit ${highPrio.length === 1 ? 'taak' : 'taken'} open`,
      module: 'todos',
      icon: '🔴',
    })
  }

  // ── Financiën ──
  if (ctx.finance.overdueCount > 0) {
    insights.push({
      type: 'error',
      text: `${ctx.finance.overdueCount} verlopen factuur${ctx.finance.overdueCount > 1 ? 'en' : ''} — actie vereist!`,
      module: 'finance',
      icon: '💸',
    })
  } else if (ctx.finance.openCount > 0) {
    insights.push({
      type: 'info',
      text: `${ctx.finance.openCount} open factuur${ctx.finance.openCount > 1 ? 'en' : ''} — totaal €${ctx.finance.openAmount.toFixed(0)}`,
      module: 'finance',
      icon: '🧾',
    })
  }

  // ── Dagboek ──
  if (!ctx.journal) {
    insights.push({
      type: 'info',
      text: 'Dagboek nog niet ingevuld voor vandaag',
      module: 'journal',
      icon: '📖',
    })
  } else if (ctx.journal.mood && ctx.journal.mood <= 2) {
    insights.push({
      type: 'warning',
      text: 'Lage stemming vandaag — zorg goed voor jezelf!',
      module: 'journal',
      icon: '💙',
    })
  }

  return insights.slice(0, 6) // Max 6 insights
}

/** Vraag AI om een dagelijkse focus-tip op basis van context */
async function generateAIFocus(contextStr: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const prompt = `Op basis van Daan's data voor vandaag, geef ONE concrete focus-tip voor vandaag in maximaal 2 zinnen. Wees specifiek met zijn echte data (namen, bedragen, streaks). Geen inleiding, direct de tip.

${contextStr}`

  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 120,
          system: 'Je bent een persoonlijke assistent. Antwoord in het Nederlands, kort en direct.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.content[0].text as string
    }

    if (process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Je bent een persoonlijke assistent. Antwoord in het Nederlands, kort en direct.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 120,
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.choices[0].message.content as string
    }
  } catch {
    return null
  }

  return null
}

export async function GET() {
  const db = await getDb()

  const [userCtx] = await Promise.all([getUserContext(db)])
  const contextStr = contextToPrompt(userCtx)

  // Rule-based insights (altijd snel)
  const insights = generateRuleBasedInsights(userCtx)

  // AI focus-tip (parallel, timeout-safe)
  const aiFocusPromise = generateAIFocus(contextStr)
  const aiFocus = await Promise.race([
    aiFocusPromise,
    new Promise<null>(r => setTimeout(() => r(null), 4000)),
  ])

  return NextResponse.json({
    insights,
    aiFocus,
    ai_powered: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY),
    summary: {
      habitsToday: `${userCtx.todayHabitsCompleted}/${userCtx.todayHabitsTotal}`,
      openTodos: userCtx.openTodos.length,
      overdueTodos: userCtx.overdueTodos,
      openFinance: userCtx.finance.openCount,
    },
  })
}
