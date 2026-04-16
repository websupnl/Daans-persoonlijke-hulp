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
  let contextData = ''

  try {
    if (type === 'finance') {
      const [monthStats, categories, recentItems] = await Promise.all([
        queryOne<{ income: number; expenses: number; net: number }>(`
          SELECT
            SUM(CASE WHEN type='inkomst' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM') THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM') THEN amount ELSE 0 END) as expenses,
            SUM(CASE WHEN type='inkomst' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM') THEN amount
                     WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM') THEN -amount
                     ELSE 0 END) as net
          FROM finance_items
        `),
        query<{ category: string; total: number; count: number }>(`
          SELECT category, SUM(amount) as total, COUNT(*) as count
          FROM finance_items
          WHERE type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')
          GROUP BY category ORDER BY total DESC LIMIT 5
        `),
        query<{ type: string; title: string; amount: number }>(`
          SELECT type, title, amount FROM finance_items
          WHERE TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM')
          ORDER BY COALESCE(due_date, created_at::date) DESC LIMIT 5
        `),
      ])

      contextData = `Financieel overzicht deze maand:
- Inkomsten: €${Number(monthStats?.income || 0).toFixed(2)}
- Uitgaven: €${Number(monthStats?.expenses || 0).toFixed(2)}
- Netto: €${Number(monthStats?.net || 0).toFixed(2)}

Top uitgavecategorieën:
${categories.map(c => `- ${c.category}: €${Number(c.total).toFixed(2)} (${c.count}x)`).join('\n') || '- Geen data'}

Recente transacties:
${recentItems.map(i => `- [${i.type}] ${i.title}: €${Number(i.amount).toFixed(2)}`).join('\n') || '- Geen data'}`
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
      const [todos, habits, workToday, workWeek, financeMonth] = await Promise.all([
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
          SELECT
            SUM(CASE WHEN type='inkomst' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM') THEN amount ELSE 0 END) as income,
            SUM(CASE WHEN type='uitgave' AND TO_CHAR(COALESCE(due_date, created_at::date),'YYYY-MM')=TO_CHAR(NOW(),'YYYY-MM') THEN amount ELSE 0 END) as expenses
          FROM finance_items
        `),
      ])

      const todayH = Math.round((Number(workToday?.minutes) || 0) / 60 * 10) / 10
      const weekH = Math.round((Number(workWeek?.minutes) || 0) / 60 * 10) / 10

      contextData = `Dagoverzicht voor Daan:
- Datum: ${new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
- Open todos: ${todos?.open || 0} (waarvan ${todos?.overdue || 0} te laat, ${todos?.dueToday || 0} vandaag)
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
Geef een korte, vriendelijke Nederlandse samenvatting in 1-2 zinnen. Wees specifiek en gebruik de echte getallen.
Geen generieke tips. Spreek Daan direct aan. Gebruik geen markdown.`,
        },
        {
          role: 'user',
          content: contextData,
        },
      ],
    })

    const summary = completion.choices[0]?.message?.content?.trim() ?? null
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[ai/summary] Error:', err)
    return NextResponse.json({ summary: null, error: 'AI niet beschikbaar' })
  }
}
