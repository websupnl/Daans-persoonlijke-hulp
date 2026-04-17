export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'
import { subDays, format } from 'date-fns'

export async function POST(req: NextRequest) {
  const { period } = await req.json()
  
  let dateFilter = ''
  let params: any[] = []
  
  if (period !== 'all') {
    const days = parseInt(period) || 30
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd')
    dateFilter = 'WHERE date >= $1'
    params = [startDate]
  }

  const entries = await query<{ date: string; content: string; mood: number; energy: number; gratitude: string; highlights: string }>(`
    SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, content, mood, energy, gratitude, highlights
    FROM journal_entries
    ${dateFilter}
    ORDER BY date ASC
  `, params)

  if (entries.length === 0) {
    return NextResponse.json({ 
      summary: 'Geen dagboekentries gevonden voor deze periode.',
      themes: [],
      energyGivers: [],
      energyDrainers: [],
      patterns: [],
      development: ''
    })
  }

  // Prepare context for AI
  const entriesContext = entries.map(e => {
    const gratitude = JSON.parse(e.gratitude || '[]').join(', ')
    return `Datum: ${e.date}\nMood: ${e.mood || '?'}/5, Energy: ${e.energy || '?'}/5\nContent: ${e.content}\nHoogtepunten: ${e.highlights || ''}\nDankbaar voor: ${gratitude}\n---`
  }).join('\n\n')

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key niet geconfigureerd' }, { status: 500 })
  }

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je bent een analytische maar persoonlijke coach voor Daan. 
Analyseer zijn dagboekentries en geef een helder overzicht van zijn welzijn en bezigheden.

Richtlijnen:
- Toon: helder, persoonlijk, direct, aanmoedigend maar nuchter (niet te zweverig).
- Taal: Nederlands.
- Wees specifiek: noem namen van mensen, projecten of plekken als die terugkomen.
- Focus op patronen en inzichten die hij zelf misschien over het hoofd ziet.

Je antwoord moet een JSON object zijn met de volgende structuur:
{
  "summary": "Korte, krachtige algemene samenvatting (3-4 zinnen)",
  "themes": ["Lijst van 3-4 terugkerende thema's"],
  "energyGivers": ["Wat geeft Daan energie? (3-5 items)"],
  "energyDrainers": ["Wat kost Daan energie? (3-5 items)"],
  "patterns": ["Opvallende patronen of correlaties (bijv. tussen werkdruk en mood)"],
  "development": "Beschrijving van de ontwikkeling over de tijd in deze periode"
}`,
      },
      {
        role: 'user',
        content: `Hier zijn de dagboekentries van de afgelopen periode:\n\n${entriesContext}\n\nAnalyseer deze en geef de inzichten in JSON formaat.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })

  const insightsData = JSON.parse(response.choices[0]?.message?.content || '{}')
  
  const defaultInsights = {
    summary: 'Kon geen samenvatting genereren op basis van de beschikbare gegevens.',
    themes: [],
    energyGivers: [],
    energyDrainers: [],
    patterns: [],
    development: 'Onvoldoende data om een ontwikkeling te beschrijven.'
  }

  return NextResponse.json({ ...defaultInsights, ...insightsData })
}
