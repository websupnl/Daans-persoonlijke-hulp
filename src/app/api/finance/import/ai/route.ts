export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { enrichTransaction, getFinanceRules } from '@/lib/finance/engine'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { text, account = 'privé' } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Geen tekst ontvangen' }, { status: 400 })
    }

    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Je bent een financieel analist gespecialiseerd in het parseren van bankgegevens.
Je krijgt ruwe tekst van een bankafschrift (waarschijnlijk Rabobank PDF export) en moet deze omzetten naar een JSON object met een "transactions" array.

Elke transactie in de "transactions" array MOET de volgende velden hebben:
- date (string, YYYY-MM-DD)
- description (string, max 120 tekens, focus op de tegenpartij)
- amount (number, positief getal)
- type (string, 'inkomst' of 'uitgave')

Regels voor Rabobank PDF tekst:
- Datums staan vaak als DD-MM-YYYY of DD-MM.
- Bedragen staan soms met een minteken voor uitgaven.
- Gebruik je intelligentie om te bepalen wat de datum, tegenpartij en het bedrag is.
- Als je twijfelt over een regel, sla deze dan over.

Voorbeeld output:
{
  "transactions": [
    { "date": "2024-03-01", "description": "Albert Heijn", "amount": 42.50, "type": "uitgave" }
  ]
}

REAGEER ALLEEN MET HET JSON OBJECT.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      response_format: { type: 'json_object' }
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'AI kon de tekst niet parseren' }, { status: 500 })
    }

    let parsed: { transactions: any[] }
    try {
      parsed = JSON.parse(content)
      // If AI returned the array directly instead of wrapping it in an object
      if (Array.isArray(parsed)) {
        parsed = { transactions: parsed }
      }
    } catch (e) {
      return NextResponse.json({ error: 'Fout bij het verwerken van AI output' }, { status: 500 })
    }

    const rules = await getFinanceRules()
    
    const enrichedTransactions = await Promise.all(parsed.transactions.map(async (t) => {
      const enrichment = enrichTransaction({ title: t.description, account }, rules.find(r => r.merchant_key === t.description))
      
      // Check for duplicates
      const existing = await query(`
        SELECT id FROM finance_items
        WHERE type = $1
          AND title = $2
          AND ROUND(amount::numeric, 2) = ROUND($3::numeric, 2)
          AND (due_date = $4::date OR (due_date IS NULL AND created_at::date = $4::date))
          AND account = $5
        LIMIT 1
      `, [t.type, t.description, t.amount, t.date, account])

      return {
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: enrichment.category,
        subcategory: enrichment.subcategory,
        merchant_raw: t.description,
        merchant_normalized: enrichment.merchantKey,
        category_confidence: enrichment.categoryConfidence,
        account,
        is_duplicate: existing.length > 0
      }
    }))

    return NextResponse.json({ preview: enrichedTransactions, count: enrichedTransactions.length })
  } catch (error: any) {
    console.error('AI Import Error:', error)
    return NextResponse.json({ error: error.message || 'Interne serverfout' }, { status: 500 })
  }
}
