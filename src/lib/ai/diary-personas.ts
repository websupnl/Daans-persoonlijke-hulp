/**
 * Diary Personas — Expert System for Journal Interactions
 *
 * Combines three expert voices:
 * 1. Clinical Psychologist — emotional patterns, defense mechanisms
 * 2. Stoic Philosopher — control vs. acceptance, values alignment
 * 3. High-Performance Executive Coach — mood/energy → productivity links
 *
 * Used when Daan interacts with his diary, asks for reflection,
 * or starts a journaling session via Telegram.
 */

import { getOpenAIClient } from './openai-client'
import { query, queryOne, execute } from '../db'

export interface DiaryAnalysis {
  followUpQuestion: string
  patternObservation: string | null
  coachingInsight: string | null
  sentiment: 'positief' | 'neutraal' | 'gespannen' | 'negatief' | 'onbekend'
  themes: string[]
}

export interface JournalConversationState {
  sessionId: string
  state: 'idle' | 'waiting_entry' | 'waiting_followup' | 'complete'
  pendingQuestion: string | null
  contextSnapshot: Record<string, unknown>
}

const DIARY_SYSTEM_PROMPT = `Je bent de gecombineerde expertise van drie experts die Daan al een jaar kennen:

**Dr. Mira Janssen — Klinisch Psycholoog**
- Herkent emotionele patronen die Daan zelf niet ziet
- Identificeert verdedigingsmechanismen ("Ik ben prima" als het tegendeel waar is)
- Verbindt huidige situatie met terugkerende thema's
- Vraagt naar wat er *niet* gezegd wordt

**Marcus — Stoïcijns Filosoof**
- Onderscheidt wat in Daans controle is en wat niet
- Vraagt naar de afstemming tussen zijn acties en zijn waarden
- Daagt uit: "Is dit echt belangrijk, of voel je je alleen verplicht?"
- Herinnert aan het korte nu vs. lange termijn

**Coach Alex — High-Performance Executive Coach**
- Koppelt stemming en energie aan productiviteitspatronen
- Ziet de link tussen levensstijl en prestatie
- Stelt concrete gedragsveranderingen voor
- Is resultaatgericht maar niet koud

Samen analyseer je wat Daan schrijft en stel je ALTIJD een vervolgvraag die één laag dieper gaat.

REGELS:
- Schrijf in het Nederlands, informeel maar intelligent
- Maximaal 3-4 zinnen totaal per respons (inclusief vraag)
- De vraag is altijd aan het eind en is concreet/specifiek
- Gebruik nooit vage termen als "misschien" of "zou kunnen"
- Wees eerlijk maar niet aanvallend
- Als iets opvalt dat eerder ook speelde: benoem het expliciet`

/**
 * Analyze a diary entry and generate expert feedback + follow-up question.
 */
export async function analyzeDiaryEntry(
  content: string,
  mood: number | null,
  energy: number | null,
  recentContext?: string
): Promise<DiaryAnalysis> {
  const openai = getOpenAIClient()

  if (!process.env.OPENAI_API_KEY) {
    return fallbackAnalysis(content, mood)
  }

  // Get historical patterns
  const historicalEntries = await query<{ date: string; content: string; mood: number }>(`
    SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, LEFT(content, 150) as content, mood
    FROM journal_entries
    ORDER BY date DESC
    LIMIT 10
    OFFSET 1
  `).catch(() => [])

  // Get AI theories for context
  const theories = await query<{ category: string; theory: string }>(`
    SELECT category, theory FROM ai_theories ORDER BY last_updated DESC LIMIT 3
  `).catch(() => [])

  const historicalContext = historicalEntries.length > 0
    ? '\n\nVorige entries:\n' + historicalEntries.map(e => `[${e.date}, mood ${e.mood}] ${e.content}`).join('\n')
    : ''

  const theoriesContext = theories.length > 0
    ? '\n\nBekende patronen:\n' + theories.map(t => `[${t.category}] ${t.theory}`).join('\n')
    : ''

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: DIARY_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Nieuwe dagboekentry van Daan:

"${content}"

Stemming: ${mood ?? 'niet opgegeven'}/5
Energie: ${energy ?? 'niet opgegeven'}/5
${recentContext ? `\nContext: ${recentContext}` : ''}
${historicalContext}
${theoriesContext}

Analyseer dit en reageer in JSON:
{
  "followUpQuestion": "...",
  "patternObservation": "..." or null,
  "coachingInsight": "..." or null,
  "sentiment": "positief|neutraal|gespannen|negatief|onbekend",
  "themes": ["...", "..."]
}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  })

  try {
    const result = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    return {
      followUpQuestion: result.followUpQuestion ?? 'Hoe voel je je hier écht over?',
      patternObservation: result.patternObservation ?? null,
      coachingInsight: result.coachingInsight ?? null,
      sentiment: result.sentiment ?? 'onbekend',
      themes: Array.isArray(result.themes) ? result.themes : [],
    }
  } catch {
    return fallbackAnalysis(content, mood)
  }
}

function fallbackAnalysis(content: string, mood: number | null): DiaryAnalysis {
  const lowMoodQuestions = [
    'Wat is de ene concrete stap die je morgen kunt nemen om dit te verbeteren?',
    'Als dit gevoel een naam had, wat zou dat zijn — en wat heeft het nodig?',
    'Welk deel hiervan is in jouw controle, en welk deel niet?',
  ]
  const neutralQuestions = [
    'Wat heb je vandaag geleerd — ook als het niet vanzelfsprekend lijkt?',
    'Is er iets wat je vandaag niet hebt gezegd dat je wel had willen zeggen?',
    'Welke keuze heeft het meeste invloed gehad op hoe je dag verliep?',
  ]

  const questions = (mood !== null && mood <= 2) ? lowMoodQuestions : neutralQuestions
  const q = questions[Math.floor(Math.random() * questions.length)]

  const themes: string[] = []
  if (/bouma|werk|elektr/i.test(content)) themes.push('werk')
  if (/websup|klant|project/i.test(content)) themes.push('WebsUp')
  if (/moe|slaap|rust/i.test(content)) themes.push('energie')
  if (/geld|euro|factuur/i.test(content)) themes.push('financiën')

  return {
    followUpQuestion: q,
    patternObservation: null,
    coachingInsight: null,
    sentiment: mood === null ? 'onbekend' : mood >= 4 ? 'positief' : mood === 3 ? 'neutraal' : mood === 2 ? 'gespannen' : 'negatief',
    themes,
  }
}

/**
 * Format diary analysis as a Telegram message.
 */
export function formatDiaryAnalysisForTelegram(analysis: DiaryAnalysis): string {
  const parts: string[] = []

  if (analysis.patternObservation) {
    parts.push(`🔍 ${analysis.patternObservation}`)
  }

  if (analysis.coachingInsight) {
    parts.push(`⚡ ${analysis.coachingInsight}`)
  }

  parts.push(`\n💬 *${analysis.followUpQuestion}*`)

  if (analysis.themes.length > 0) {
    parts.push(`\n_Thema's: ${analysis.themes.join(', ')}_`)
  }

  return parts.join('\n')
}

/**
 * Update or create AI theory based on recurring patterns.
 * Called periodically to keep theories fresh.
 */
export async function updateAITheories(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return

  const openai = getOpenAIClient()

  // Get enough data to spot patterns
  const [journalEntries, financeItems, workLogs, habitLogs] = await Promise.all([
    query<{ date: string; content: string; mood: number; energy: number }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, LEFT(content, 200) as content, mood, energy
      FROM journal_entries ORDER BY date DESC LIMIT 20
    `).catch(() => []),
    query<{ type: string; amount: number; category: string; created_at: string }>(`
      SELECT type, amount, category, TO_CHAR(created_at, 'YYYY-MM-DD') as created_at
      FROM finance_items ORDER BY created_at DESC LIMIT 30
    `).catch(() => []),
    query<{ date: string; context: string; duration_minutes: number; energy_level: number }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, context,
             COALESCE(actual_duration_minutes, duration_minutes) as duration_minutes,
             energy_level
      FROM work_logs ORDER BY date DESC LIMIT 20
    `).catch(() => []),
    query<{ habit_name: string; logged_date: string }>(`
      SELECT h.name as habit_name, TO_CHAR(hl.logged_date, 'YYYY-MM-DD') as logged_date
      FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      ORDER BY hl.logged_date DESC LIMIT 40
    `).catch(() => []),
  ])

  if (journalEntries.length < 5) return // Not enough data

  const dataContext = `
Dagboek (20 recente entries):
${journalEntries.map(e => `[${e.date}] mood:${e.mood} energie:${e.energy} — ${e.content}`).join('\n')}

Financiën (30 recente):
${financeItems.map(f => `[${f.created_at}] ${f.type} €${f.amount} (${f.category})`).join('\n')}

Werk (20 recente):
${workLogs.map(w => `[${w.date}] ${w.context} ${Math.round(w.duration_minutes / 60 * 10) / 10}u energie:${w.energy_level}`).join('\n')}

Gewoontedata (40 recent):
${habitLogs.map(h => `[${h.logged_date}] ${h.habit_name}`).join('\n')}
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je analyseert langetermijndata van Daan en formuleert 3-5 "theorieën" — patronen die je hebt ontdekt.
Elke theorie:
- Is een concrete, falsifieerbare observatie over zijn gedrag of patroon
- Combineert bij voorkeur 2+ modules
- Heeft een categorie: financieel_gedrag | emotioneel_patroon | productiviteit | gewoonte | werk_privé

Geef output als JSON array:
[
  {
    "category": "...",
    "theory": "...",
    "confidence": 0.0-1.0
  }
]`,
      },
      { role: 'user', content: dataContext },
    ],
    temperature: 0.5,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  })

  try {
    const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    const theories: Array<{ category: string; theory: string; confidence: number }> =
      Array.isArray(raw) ? raw : (Array.isArray(raw.theories) ? raw.theories : [])

    for (const t of theories) {
      if (!t.category || !t.theory) continue
      // Upsert: if similar theory exists (same category, updated recently), update it
      const existing = await queryOne<{ id: number }>(`
        SELECT id FROM ai_theories
        WHERE category = $1 AND last_updated >= NOW() - INTERVAL '7 days'
        ORDER BY last_updated DESC LIMIT 1
      `, [t.category])

      if (existing) {
        await execute(`
          UPDATE ai_theories
          SET theory = $1, confidence = $2, last_updated = NOW(), times_confirmed = times_confirmed + 1
          WHERE id = $3
        `, [t.theory, t.confidence ?? 0.5, existing.id])
      } else {
        await execute(`
          INSERT INTO ai_theories (category, theory, confidence)
          VALUES ($1, $2, $3)
        `, [t.category, t.theory, t.confidence ?? 0.5])
      }
    }
  } catch (err) {
    console.error('[DiaryPersonas] Failed to update AI theories:', err instanceof Error ? err.message : err)
  }
}
