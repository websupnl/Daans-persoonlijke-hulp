export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { analyzeFinance, getFinanceRules, FinanceRow } from '@/lib/finance/engine'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function POST() {
  const rows = (await query<FinanceRow>(
    `SELECT id, type, title,
            amount::float AS amount,
            category, account, status, due_date,
            COALESCE(due_date, created_at::date)::text AS transaction_date,
            created_at,
<<<<<<< HEAD
            merchant_normalized,
            merchant_raw,
            subcategory,
            recurrence_type,
            recurrence_confidence,
            subscription_status,
            fixed_cost_flag,
            essential_flag,
            personal_business,
            user_verified,
            user_notes,
            needs_review
=======
            NULL AS merchant_normalized,
            NULL AS merchant_raw,
            NULL AS subcategory,
            NULL AS recurrence_type,
            NULL AS recurrence_confidence,
            NULL AS subscription_status,
            NULL AS fixed_cost_flag,
            NULL AS essential_flag,
            NULL AS personal_business,
            NULL AS user_verified,
            NULL AS user_notes,
            NULL AS needs_review
>>>>>>> origin/main
     FROM finance_items
     WHERE type IN ('inkomst','uitgave')
     ORDER BY COALESCE(due_date, created_at::date) DESC
     LIMIT 2000`
  )).map(r => ({ ...r, created_at: new Date(r.created_at).toISOString() }))

  if (rows.length < 5) {
    return NextResponse.json({ error: 'Te weinig transacties voor analyse (minimaal 5 nodig)' }, { status: 422 })
  }

  const rules = await getFinanceRules()
  const result = analyzeFinance(rows, rules)

  // AI inzichten — alleen op basis van betrouwbare groups (confidence >= 0.6)
  let aiInsights = ''
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = getOpenAIClient()
      const { aiContext } = result

      const betrouwbareGroups = aiContext.recurringGroups.filter(g => g.recurrenceConfidence >= 0.6)
      const summaryForAI = {
        samenvatting: {
          transacties: aiContext.summary.transactionCount,
          inkomsten: `€${aiContext.summary.totalIncome}`,
          uitgaven: `€${aiContext.summary.totalExpenses}`,
          netto: `€${aiContext.summary.net}`,
          bevestigdeVasteLasten: `€${aiContext.summary.fixedMonthlyCost}/mnd`,
          bevestigdeAbonnementen: `€${aiContext.summary.subscriptionMonthlyCost}/mnd`,
          onzekereTerugkerend: aiContext.summary.uncertainRecurringCount,
        },
        vasteLasten: betrouwbareGroups
          .filter(g => g.recurrenceType === 'fixed_recurring_bill')
          .map(g => ({
            naam: g.displayName,
            maandelijksBedrag: g.monthlyEquivalent != null ? `€${g.monthlyEquivalent}` : 'onbekend',
            frequentie: g.frequency,
            zekerheid: g.confidenceLabel,
            uitleg: g.explanation,
          })),
        abonnementen: betrouwbareGroups
          .filter(g => g.recurrenceType === 'probable_subscription' || g.recurrenceType === 'confirmed_subscription')
          .map(g => ({
            naam: g.displayName,
            maandelijksBedrag: g.monthlyEquivalent != null ? `€${g.monthlyEquivalent}` : 'onbekend',
            bevestigd: g.recurrenceType === 'confirmed_subscription',
            zekerheid: g.confidenceLabel,
          })),
        // Merchants die NOG NIET bevestigd zijn — AI mag hier GEEN harde conclusies over trekken
        nogTeBevestigen: aiContext.reviewQuestions.map(q => ({
          merchant: q.merchantLabel,
          vraag: q.prompt,
          reden: q.rationale,
        })),
        anomalieën: aiContext.anomalies.map(a => ({
          titel: a.title,
          bedrag: `€${a.amount}`,
          reden: a.reason,
          ernst: a.severity,
        })),
        trendLaatste3Maanden: aiContext.trends.slice(-3).map(t => ({
          maand: t.month,
          inkomsten: `€${t.income}`,
          uitgaven: `€${t.expenses}`,
          netto: `€${t.net}`,
          topCategorie: t.topCategory,
        })),
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: `Je bent een voorzichtige, eerlijke financieel analist voor Daan. Houd je strikt aan deze regels:

REGELS:
1. Gebruik ALLEEN data die je hebt ontvangen. Verzin niets, gok niets.
2. Trek alleen conclusies over merchants in vasteLasten of abonnementen.
3. Merchants in nogTeBevestigen zijn NIET bevestigd. Noem ze als twijfelachtig of sla ze over.
4. Als iets onduidelijk is, zeg dan expliciet: "Ik weet dit niet zeker" of "Dit moet je nog bevestigen".
5. Gebruik confidence-indicatoren: zeker / waarschijnlijk / twijfelachtig.
6. Formuleer nooit: "X kost je €Y per maand als abonnement" tenzij X in abonnementen staat.
7. Sluit af met maximaal 1 vraag als je iets nodig hebt van Daan.

FORMAAT: Bullet points (•), max 6 punten, direct en specifiek.`,
          },
          {
            role: 'user',
            content: `Analyseer Daans financiën en geef eerlijke, voorzichtige inzichten:\n\n${JSON.stringify(summaryForAI, null, 2)}`,
          },
        ],
      })
      aiInsights = completion.choices[0]?.message?.content ?? ''
    } catch {
      aiInsights = ''
    }
  }

  return NextResponse.json({ ...result, aiInsights })
}
