export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface FinanceRow {
  id: number
  type: string
  title: string
  amount: number
  category: string
  account: string
  status: string
  due_date: string | null
  created_at: string
}

interface Subscription {
  name: string
  amount: number
  frequency: string
  monthlyEquivalent: number
  lastSeen: string
  count: number
}

interface SpendingPattern {
  merchant: string
  totalSpent: number
  visits: number
  avgAmount: number
  category: string
}

interface MonthlyTrend {
  month: string
  income: number
  expenses: number
  net: number
  topCategory: string
}

interface Anomaly {
  title: string
  amount: number
  date: string
  reason: string
  severity: 'low' | 'medium' | 'high'
}

function detectSubscriptions(rows: FinanceRow[]): Subscription[] {
  const expenses = rows.filter(r => r.type === 'uitgave')

  // Group by normalized title (lowercase, strip punctuation)
  const groups: Record<string, FinanceRow[]> = {}
  for (const row of expenses) {
    const key = row.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 3)
      .join(' ')
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
  }

  const subs: Subscription[] = []
  for (const [, items] of Object.entries(groups)) {
    if (items.length < 2) continue

    // Sort by date
    const sorted = items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Check if amounts are consistent (within 5%)
    const amounts = sorted.map(i => i.amount)
    const avgAmt = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const maxDev = Math.max(...amounts.map(a => Math.abs(a - avgAmt) / avgAmt))
    if (maxDev > 0.1) continue // > 10% deviation = not subscription

    // Check intervals
    const dates = sorted.map(i => new Date(i.created_at).getTime())
    const intervals = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24))
    }
    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length

    let frequency = ''
    let monthlyEquivalent = 0
    if (avgInterval < 10) { frequency = 'wekelijks'; monthlyEquivalent = avgAmt * 4.33 }
    else if (avgInterval < 40) { frequency = 'maandelijks'; monthlyEquivalent = avgAmt }
    else if (avgInterval < 100) { frequency = 'kwartaal'; monthlyEquivalent = avgAmt / 3 }
    else if (avgInterval < 400) { frequency = 'jaarlijks'; monthlyEquivalent = avgAmt / 12 }
    else continue

    subs.push({
      name: sorted[sorted.length - 1].title,
      amount: avgAmt,
      frequency,
      monthlyEquivalent,
      lastSeen: sorted[sorted.length - 1].created_at.split('T')[0],
      count: sorted.length,
    })
  }

  return subs.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent)
}

function topSpendingPatterns(rows: FinanceRow[]): SpendingPattern[] {
  const expenses = rows.filter(r => r.type === 'uitgave')
  const groups: Record<string, FinanceRow[]> = {}

  for (const row of expenses) {
    // Use first 2-3 meaningful words as merchant key
    const words = row.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/).slice(0, 2).join(' ')
    if (!groups[words]) groups[words] = []
    groups[words].push(row)
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length >= 2)
    .map(([merchant, items]) => ({
      merchant: items[0].title.split(' ').slice(0, 3).join(' '),
      totalSpent: items.reduce((s, i) => s + i.amount, 0),
      visits: items.length,
      avgAmount: items.reduce((s, i) => s + i.amount, 0) / items.length,
      category: items[0].category,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)
}

function buildMonthlyTrends(rows: FinanceRow[]): MonthlyTrend[] {
  const byMonth: Record<string, { income: number; expenses: number; cats: Record<string, number> }> = {}

  for (const row of rows) {
    const month = row.created_at.slice(0, 7)
    if (!byMonth[month]) byMonth[month] = { income: 0, expenses: 0, cats: {} }
    if (row.type === 'inkomst') byMonth[month].income += row.amount
    else {
      byMonth[month].expenses += row.amount
      byMonth[month].cats[row.category] = (byMonth[month].cats[row.category] || 0) + row.amount
    }
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      income: Math.round(d.income * 100) / 100,
      expenses: Math.round(d.expenses * 100) / 100,
      net: Math.round((d.income - d.expenses) * 100) / 100,
      topCategory: Object.entries(d.cats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'onbekend',
    }))
}

function detectAnomalies(rows: FinanceRow[], patterns: SpendingPattern[]): Anomaly[] {
  const anomalies: Anomaly[] = []

  // Large single transactions (> 2x avg expense)
  const expenses = rows.filter(r => r.type === 'uitgave')
  if (expenses.length > 5) {
    const avgExpense = expenses.reduce((s, r) => s + r.amount, 0) / expenses.length
    const p95 = expenses.map(r => r.amount).sort((a, b) => a - b)[Math.floor(expenses.length * 0.95)]

    for (const row of expenses) {
      if (row.amount > Math.max(avgExpense * 3, p95)) {
        anomalies.push({
          title: row.title,
          amount: row.amount,
          date: row.created_at.split('T')[0],
          reason: `Uitzonderlijk hoog — ${Math.round(row.amount / avgExpense)}x het gemiddelde (€${Math.round(avgExpense)})`,
          severity: row.amount > avgExpense * 5 ? 'high' : 'medium',
        })
      }
    }
  }

  // Duplicate transactions on same day
  const byDayTitle: Record<string, FinanceRow[]> = {}
  for (const row of rows) {
    const key = `${row.created_at.slice(0, 10)}_${row.title.toLowerCase().trim()}`
    if (!byDayTitle[key]) byDayTitle[key] = []
    byDayTitle[key].push(row)
  }
  for (const [, dupes] of Object.entries(byDayTitle)) {
    if (dupes.length > 1) {
      anomalies.push({
        title: dupes[0].title,
        amount: dupes[0].amount,
        date: dupes[0].created_at.split('T')[0],
        reason: `Mogelijk dubbel — ${dupes.length}x op dezelfde dag`,
        severity: 'low',
      })
    }
  }

  return anomalies
    .sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.severity] - { high: 3, medium: 2, low: 1 }[a.severity]))
    .slice(0, 8)
}

export async function POST() {
  const rows = (await query<FinanceRow>(
    `SELECT id, type, title, amount, category, account, status, due_date, created_at
     FROM finance_items
     WHERE type IN ('inkomst','uitgave')
     ORDER BY created_at DESC
     LIMIT 2000`
  )).map(r => ({ ...r, created_at: new Date(r.created_at).toISOString() }))

  if (rows.length < 5) {
    return NextResponse.json({ error: 'Te weinig transacties voor analyse (minimaal 5 nodig)' }, { status: 422 })
  }

  const subscriptions = detectSubscriptions(rows)
  const patterns = topSpendingPatterns(rows)
  const trends = buildMonthlyTrends(rows)
  const anomalies = detectAnomalies(rows, patterns)

  // Totals
  const totalIncome = rows.filter(r => r.type === 'inkomst').reduce((s, r) => s + r.amount, 0)
  const totalExpenses = rows.filter(r => r.type === 'uitgave').reduce((s, r) => s + r.amount, 0)
  const monthlySubCost = subscriptions.reduce((s, sub) => s + sub.monthlyEquivalent, 0)

  // Build compact summary for GPT
  const summaryForAI = {
    totalTransactions: rows.length,
    totalIncome: Math.round(totalIncome),
    totalExpenses: Math.round(totalExpenses),
    net: Math.round(totalIncome - totalExpenses),
    subscriptionsCost: Math.round(monthlySubCost),
    topSubscriptions: subscriptions.slice(0, 5).map(s => `${s.name} (${s.frequency}, €${Math.round(s.monthlyEquivalent)}/mnd)`),
    topMerchants: patterns.slice(0, 5).map(p => `${p.merchant}: €${Math.round(p.totalSpent)} (${p.visits}x)`),
    last3Months: trends.slice(-3).map(t => `${t.month}: +€${t.income} -€${t.expenses} = €${t.net}`),
    anomalyCount: anomalies.length,
  }

  let aiInsights = ''
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `Je bent een slimme persoonlijke financieel analist voor Daan. Geef beknopte, actionable inzichten in het Nederlands. Wees direct en specifiek — geen vage algemeenheden. Gebruik bullet points (•).`,
        },
        {
          role: 'user',
          content: `Analyseer deze financiële data en geef 4-6 scherpe inzichten:

${JSON.stringify(summaryForAI, null, 2)}

Focus op:
1. Abonnementen die misschien onnodig zijn
2. Opvallende trends (groei/daling)
3. Besparingskansen
4. Inkomensstabiliteit
5. Eventuele zorgen`,
        },
      ],
    })
    aiInsights = completion.choices[0]?.message?.content ?? ''
  } catch {
    aiInsights = ''
  }

  return NextResponse.json({
    subscriptions,
    patterns: patterns.slice(0, 8),
    trends: trends.slice(-6),
    anomalies,
    summary: {
      totalIncome: Math.round(totalIncome),
      totalExpenses: Math.round(totalExpenses),
      net: Math.round(totalIncome - totalExpenses),
      monthlySubCost: Math.round(monthlySubCost),
      transactionCount: rows.length,
    },
    aiInsights,
  })
}
