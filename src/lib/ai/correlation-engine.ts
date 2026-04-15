/**
 * Silent Correlation Engine
 *
 * Runs asynchronously after message ingestion (20% of the time) to detect
 * behavioural patterns in recent activity and stores them in memory_log
 * under the category `correlation_pattern`.
 */

import { query, execute } from '../db'
import { getOpenAIClient } from './openai-client'

interface ActivityEntry {
  entity_type: string
  action: string
  title: string
  summary?: string
  created_at: string
}

export async function runSilentCorrelation(): Promise<void> {
  if (Math.random() > 0.2) return

  try {
    const activities = await query<ActivityEntry>(`
      SELECT entity_type, action, title, summary,
             TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at
      FROM activity_log
      ORDER BY created_at DESC
      LIMIT 50
    `)

    if (activities.length < 5) return

    const activityText = activities
      .map(a => `[${a.created_at}] ${a.entity_type}/${a.action}: ${a.title}${a.summary ? ` — ${a.summary}` : ''}`)
      .join('\n')

    const client = getOpenAIClient()

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Je bent een stille patroon-herkenner voor Daan's persoonlijke assistent. 
Analyseer de recente activiteitslog en vind 1-2 concrete gedragspatronen of inzichten.
Geef ALLEEN geldige JSON terug in dit schema:
{
  "patterns": [
    { "key": "korte_sleutel_zonder_spaties", "insight": "Nederlandse zin over het patroon" }
  ]
}
Voorbeelden van goede patronen:
- "Daan logt werkuren voor Bouma vlak na het loggen van sport-gewoontes"
- "Daan maakt 's avonds na 21:00 vaker inbox-items aan dan todos"
- "Projecten van WebsUp krijgen vaker hoge prioriteit todos"
Geef maximaal 2 patronen. Als er geen duidelijk patroon is, geef dan patterns: [].`,
        },
        {
          role: 'user',
          content: `Recente activiteitslog:\n${activityText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return

    const parsed = JSON.parse(raw) as { patterns?: Array<{ key: string; insight: string }> }
    if (!Array.isArray(parsed.patterns)) return

    for (const pattern of parsed.patterns) {
      if (!pattern.key || !pattern.insight) continue

      const sanitizedKey = `correlation_${pattern.key.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 80)}`

      await execute(`
        INSERT INTO memory_log (key, value, category, confidence)
        VALUES ($1, $2, 'correlation_pattern', 0.7)
        ON CONFLICT(key) DO UPDATE
          SET value = EXCLUDED.value,
              last_reinforced_at = NOW(),
              updated_at = NOW()
      `, [sanitizedKey, pattern.insight])
    }
  } catch (err) {
    console.error('[CorrelationEngine] Error:', err instanceof Error ? err.message : err)
  }
}
