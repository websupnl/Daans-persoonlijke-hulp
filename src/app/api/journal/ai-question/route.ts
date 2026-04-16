export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function POST(req: NextRequest) {
  const { content, mood, energy, date } = await req.json()

  if (!process.env.OPENAI_API_KEY) {
    const fallbacks = [
      'Wat nam vandaag de meeste mentale ruimte in, ook als het niet op je lijst stond?',
      'Als je terugkijkt op deze dag over een week — wat zou je dan als belangrijk onthouden?',
      'Welk moment van vandaag wil je bewust vasthouden?',
      'Wat heb je vandaag uitgesteld, en waarom?',
      'Wat zou je anders doen als je de dag opnieuw kon doen?',
    ]
    return NextResponse.json({ question: fallbacks[Math.floor(Math.random() * fallbacks.length)] })
  }

  // Fetch recent journal context
  const recentEntries = await query<{ date: string; content: string; mood: number; energy: number }>(`
    SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, LEFT(content, 200) as content, mood, energy
    FROM journal_entries
    WHERE date < $1
    ORDER BY date DESC LIMIT 4
  `, [date || new Date().toISOString().split('T')[0]]).catch(() => [])

  const recentContext = recentEntries.length > 0
    ? '\n\nRecente dagen:\n' + recentEntries.map(e => `[${e.date}, mood ${e.mood ?? '?'}/5] ${e.content}`).join('\n')
    : ''

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je bent een empathische dagboek-coach voor Daan, een drukke elektricien/ondernemer.
Stel één gerichte vervolgvraag op basis van wat hij net heeft geschreven.

Regels:
- Maximaal 2 zinnen
- Gebruik echte details uit zijn tekst als dat kan
- Niet vaag ("hoe voelde dat?") maar specifiek en uitnodigend
- Toon: betrokken en direct, niet therapeutisch
- Schrijf in het Nederlands
- Geen inleiding, geen afsluiting — alleen de vraag zelf`,
      },
      {
        role: 'user',
        content: `Datum: ${date || 'vandaag'}
Stemming: ${mood ? `${mood}/5` : 'niet ingevuld'}
Energie: ${energy ? `${energy}/5` : 'niet ingevuld'}
Geschreven tekst:\n${content || '(nog niets geschreven)'}${recentContext}

Stel nu één vervolgvraag.`,
      },
    ],
    temperature: 0.85,
    max_tokens: 120,
  })

  const question = response.choices[0]?.message?.content?.trim() ?? 'Wat nam vandaag de meeste mentale ruimte in?'
  return NextResponse.json({ question })
}
