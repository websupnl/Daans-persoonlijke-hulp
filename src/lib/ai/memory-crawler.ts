/**
 * Memory Crawler — cross-module memory synthesizer
 *
 * Distills structural long-term facts from all data modules:
 * todos, finance, journal, habits, contacts, notes, projects.
 *
 * Run nightly (03:00) via pulse cron. Also callable via POST /api/memory/generate.
 */

import { query, execute } from '@/lib/db'
import { getOpenAIClient } from './openai-client'

export async function generateMemories(): Promise<{ saved: number; total: number }> {
  if (!process.env.OPENAI_API_KEY) return { saved: 0, total: 0 }

  const [todos, finance, journal, habits, contacts, notes, projects] = await Promise.all([
    query<{ title: string; priority: string; completed: number }>(
      `SELECT title, priority, completed FROM todos ORDER BY created_at DESC LIMIT 20`
    ).catch(() => []),

    query<{ type: string; category: string; amount: number }>(
      `SELECT type, category, SUM(amount) as amount FROM finance_items GROUP BY type, category ORDER BY amount DESC LIMIT 15`
    ).catch(() => []),

    query<{ date: string; content: string; mood: number; energy: number }>(
      `SELECT TO_CHAR(date,'YYYY-MM-DD') as date, LEFT(content,300) as content, mood, energy FROM journal_entries ORDER BY date DESC LIMIT 5`
    ).catch(() => []),

    query<{ name: string; logged_days: number }>(
      `SELECT h.name, COUNT(hl.id)::int as logged_days FROM habits h LEFT JOIN habit_logs hl ON hl.habit_id = h.id WHERE h.active = 1 GROUP BY h.name`
    ).catch(() => []),

    query<{ name: string; company: string }>(
      `SELECT name, company FROM contacts ORDER BY created_at DESC LIMIT 10`
    ).catch(() => []),

    query<{ title: string; content_text: string; tags: string; updated_at: string }>(
      `SELECT title, LEFT(content_text, 150) as content_text, tags, TO_CHAR(updated_at, 'YYYY-MM-DD') as updated_at FROM notes ORDER BY updated_at DESC LIMIT 15`
    ).catch(() => []),

    query<{ title: string; status: string; description: string }>(
      `SELECT title, status, LEFT(description, 150) as description FROM projects ORDER BY updated_at DESC LIMIT 10`
    ).catch(() => []),
  ])

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je analyseert data van Daan (ondernemer/elektricien bij Bouma, eigenaar WebsUp.nl) en destilleert structurele feiten die de AI langdurig moet onthouden.

Geef een JSON-object terug: { "memories": [...] }
Elke memory: { "key": "unieke_sleutel", "value": "wat onthouden moet worden", "category": "personal_context|business_fact|work_pattern|preference|routine|project_context|note_insight" }

Regels:
- Maximaal 12 memories
- Alleen stabiele feiten — geen tijdelijke events
- Keys: lowercase, underscores, geen spaties
- Values in het Nederlands, concreet en informatief
- Let op: actieve projecten, focusgebieden, notitiethema's, werkpatronen
- Baseer je uitsluitend op de aangeleverde data`,
      },
      {
        role: 'user',
        content: `DATA:

Taken (recente 20):
${todos.map(t => `- [${t.priority}] ${t.title} (${t.completed ? 'afgerond' : 'open'})`).join('\n') || 'geen'}

Financiën (per categorie):
${finance.map(f => `- ${f.type} / ${f.category}: €${Math.round(Number(f.amount))}`).join('\n') || 'geen'}

Dagboek (laatste 5 entries):
${journal.map(j => `[${j.date}] mood:${j.mood} energie:${j.energy} — ${j.content}`).join('\n') || 'geen'}

Gewoontes:
${habits.map(h => `- ${h.name}: ${h.logged_days} dagen gelogd`).join('\n') || 'geen'}

Contacten:
${contacts.map(c => `- ${c.name}${c.company ? ` (${c.company})` : ''}`).join('\n') || 'geen'}

Notities (recente 15, gesorteerd op meest recent gewijzigd):
${notes.map(n => `- [${n.updated_at}] "${n.title}": ${n.content_text || '(leeg)'}${n.tags !== '[]' ? ` | tags: ${n.tags}` : ''}`).join('\n') || 'geen'}

Projecten:
${projects.map(p => `- [${p.status}] "${p.title}": ${p.description || '(geen beschrijving)'}`).join('\n') || 'geen'}

Genereer nu de memory-array.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let memories: Array<{ key: string; value: string; category: string }> = []
  try {
    const parsed = JSON.parse(raw)
    memories = Array.isArray(parsed)
      ? parsed
      : (parsed.memories ?? parsed.data ?? [])
  } catch {
    console.error('[MemoryCrawler] Failed to parse AI response')
    return { saved: 0, total: 0 }
  }

  let saved = 0
  for (const m of memories) {
    if (!m.key || !m.value) continue
    await execute(`
      INSERT INTO memory_log (key, value, category, confidence)
      VALUES ($1, $2, $3, 0.75)
      ON CONFLICT(key) DO UPDATE
        SET value = EXCLUDED.value, category = EXCLUDED.category,
            last_reinforced_at = NOW(), updated_at = NOW()
    `, [m.key, m.value, m.category ?? 'personal_context'])
    saved++
  }

  console.log(`[MemoryCrawler] Saved ${saved}/${memories.length} memories`)
  return { saved, total: memories.length }
}
