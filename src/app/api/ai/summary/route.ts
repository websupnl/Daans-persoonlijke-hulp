export const dynamic = 'force-dynamic'

/**
 * POST /api/ai/summary
 *
 * Generate a short AI summary for a given module.
 * Body: { type: 'finance' | 'worklogs' | 'dashboard' | 'habits' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { getCachedSummary, setCachedSummary } from '@/lib/ai/cache'

export async function POST(req: NextRequest) {
  let body: { type: string }
  try {
    body = await req.json() as { type: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ summary: null, error: 'No AI key configured' })
  }

  const { type } = body
  
  // Check cache eerst om AI tokens te besparen
  const cachedSummary = getCachedSummary(type)
  if (cachedSummary) {
    return NextResponse.json({ summary: cachedSummary })
  }
  
  let contextData = ''

  try {
    if (type === 'finance') {
      const [monthStats, categories, recentItems] = await Promise.all([
        queryOne<{ income: number; expenses: number; net: number; active_month: string }>(`
          WITH active AS (
            SELECT COALESCE(
              TO_CHAR(MAX(COALESCE(due_date, created_at::date)), 'YYYY-MM'),
              TO_CHAR(NOW(), 'YYYY-MM')
            ) as month FROM finance_items
          )
          SELECT
            (SELECT month FROM active) as active_month,
            SUM(CASE WHEN type='inkomst' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active) THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active) THEN amount ELSE 0 END) as expenses,
            SUM(CASE WHEN type='inkomst' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active) THEN amount
                     WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active) THEN -amount
                     ELSE 0 END) as net
          FROM finance_items
        `),
        query<{ category: string; total: number; count: number }>(`
          WITH active AS (
            SELECT COALESCE(TO_CHAR(MAX(COALESCE(due_date, created_at::date)), 'YYYY-MM'), TO_CHAR(NOW(), 'YYYY-MM')) as month FROM finance_items
          )
          SELECT category, SUM(amount) as total, COUNT(*) as count
          FROM finance_items
          WHERE type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active)
          GROUP BY category ORDER BY total DESC LIMIT 5
        `),
        query<{ type: string; title: string; description: string | null; merchant_raw: string | null; user_notes: string | null; amount: number }>(`
          WITH active AS (
            SELECT COALESCE(TO_CHAR(MAX(COALESCE(due_date, created_at::date)), 'YYYY-MM'), TO_CHAR(NOW(), 'YYYY-MM')) as month FROM finance_items
          )
          SELECT type, title, description, merchant_raw, user_notes, amount FROM finance_items
          WHERE TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active)
          ORDER BY COALESCE(due_date, created_at::date) DESC LIMIT 5
        `),
      ])

      const activeMonth = monthStats?.active_month ?? ''
      const now2 = new Date().toISOString().slice(0, 7)
      const periodLabel = activeMonth && activeMonth !== now2
        ? `${activeMonth} (meest recente maand met data — niet de huidige kalendermaand)`
        : 'deze maand'

      contextData = `Financieel overzicht ${periodLabel}:
- Inkomsten: €${Number(monthStats?.income || 0).toFixed(2)}
- Uitgaven: €${Number(monthStats?.expenses || 0).toFixed(2)}
- Netto: €${Number(monthStats?.net || 0).toFixed(2)}

Top uitgavecategorieën:
${categories.map(c => `- ${c.category}: €${Number(c.total).toFixed(2)} (${c.count}x)`).join('\n') || '- Geen data'}

Recente transacties:
${recentItems.map(i => `- [${i.type}] ${i.title}${i.description ? ` (${i.description})` : ''}${i.merchant_raw && i.merchant_raw !== i.title ? ` [raw: ${i.merchant_raw}]` : ''}${i.user_notes ? ` (notitie: ${i.user_notes})` : ''}: €${Number(i.amount).toFixed(2)}`).join('\n') || '- Geen data'}`
    }

    if (type === 'worklogs') {
      const [weekStats, contextBreakdown, recentLogs] = await Promise.all([
        queryOne<{ total_minutes: number; total_logs: number }>(`
          SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as total_minutes, COUNT(*) as total_logs
          FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        `),
        query<{ context: string; total_minutes: number; count: number }>(`
          SELECT context, SUM(COALESCE(actual_duration_minutes, duration_minutes)) as total_minutes, COUNT(*) as count
          FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL '7 days'
          GROUP BY context ORDER BY total_minutes DESC
        `),
        query<{ title: string; context: string; duration_minutes: number; date: string }>(`
          SELECT title, context, COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes, date::text
          FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL '7 days'
          ORDER BY date DESC, created_at DESC LIMIT 8
        `),
      ])

      const totalH = Math.round((Number(weekStats?.total_minutes) || 0) / 60 * 10) / 10
      contextData = `Werklog afgelopen 7 dagen:
- Totaal: ${totalH}u (${weekStats?.total_logs || 0} logs)

Per context:
${contextBreakdown.map(c => {
  const h = Math.round((Number(c.total_minutes) || 0) / 60 * 10) / 10
  return `- ${c.context}: ${h}u (${c.count} logs)`
}).join('\n') || '- Geen data'}

Recente activiteiten:
${recentLogs.map(l => {
  const h = Math.round((Number(l.duration_minutes) || 0) / 60 * 10) / 10
  return `- [${l.date}] ${l.context}: ${l.title} (${h}u)`
}).join('\n') || '- Geen data'}`
    }

        if (type === 'dashboard') {
          const [todos, habits, workToday, workWeek, financeMonth, events] = await Promise.all([
            queryOne<{ open: number; overdue: number; dueToday: number }>(`
              SELECT
                COUNT(*) as open,
                COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue,
                COUNT(CASE WHEN due_date::date = CURRENT_DATE THEN 1 END) as dueToday
              FROM todos WHERE completed = 0
            `),
            queryOne<{ total: number; done: number }>(`
              SELECT COUNT(*) as total,
                COUNT(CASE WHEN (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id AND hl.logged_date = CURRENT_DATE) > 0 THEN 1 END) as done
              FROM habits h WHERE h.active = 1
            `),
            queryOne<{ minutes: number }>('SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as minutes FROM work_logs WHERE date = CURRENT_DATE'),
            queryOne<{ minutes: number }>('SELECT SUM(COALESCE(actual_duration_minutes, duration_minutes)) as minutes FROM work_logs WHERE date >= CURRENT_DATE - INTERVAL \'7 days\''),
            queryOne<{ income: number; expenses: number }>(`
              WITH active AS (
                SELECT COALESCE(TO_CHAR(MAX(COALESCE(due_date, created_at::date)), 'YYYY-MM'), TO_CHAR(NOW(), 'YYYY-MM')) as month FROM finance_items
              )
              SELECT
                SUM(CASE WHEN type='inkomst' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active) THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=(SELECT month FROM active) THEN amount ELSE 0 END) as expenses
              FROM finance_items
            `),
            query<{ title: string; time: string }>(`
              SELECT title, time FROM events WHERE date = CURRENT_DATE ORDER BY time ASC
            `)
          ])
    
          const todayH = Math.round((Number(workToday?.minutes) || 0) / 60 * 10) / 10
          const weekH = Math.round((Number(workWeek?.minutes) || 0) / 60 * 10) / 10
    
          contextData = `Dagoverzicht voor Daan:
    - Datum: ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
    - Open todos: ${todos?.open || 0} (waarvan ${todos?.overdue || 0} te laat, ${todos?.dueToday || 0} vandaag)
    - Agenda vandaag: ${events.map(e => `${e.time || 'Hele dag'}: ${e.title}`).join(', ') || 'Geen afspraken'}
    - Gewoontes: ${habits?.done || 0}/${habits?.total || 0} gedaan vandaag
    - Werklog vandaag: ${todayH}u, deze week: ${weekH}u
    - Financiën deze maand: €${Number(financeMonth?.income || 0).toFixed(0)} inkomsten, €${Number(financeMonth?.expenses || 0).toFixed(0)} uitgaven`
        }

    if (!contextData) {
      return NextResponse.json({ summary: null })
    }

    const client = getOpenAIClient()
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: `Je bent de persoonlijke assistent van Daan (25, elektricien bij Bouma, webdesigner bij WebsUp.nl).
Geef een krachtige, slimme Nederlandse briefing van 2-3 zinnen.
Koppel data: bijv. als hij veel heeft gewerkt maar nog todos heeft, of als hij op schema ligt met gewoontes.
Wees specifiek en gebruik de echte getallen. Spreek Daan direct aan.
Eindig ALTIJD met een suggestie voor de volgende actie (bijv. "Pak die taak X nu op" of "Neem even rust").
Gebruik geen markdown.`,
        },
        {
          role: 'user',
          content: contextData,
        },
      ],
    })

    const summary = completion.choices[0]?.message?.content?.trim() ?? null
    
    // Sla op in cache voor toekomstig gebruik
    if (summary) {
      setCachedSummary(type, summary)
    }
    
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[ai/summary] Error:', err)
    return NextResponse.json({ summary: null, error: 'AI niet beschikbaar' })
  }
}
