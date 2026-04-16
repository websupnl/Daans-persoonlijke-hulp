export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { query, execute } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

export async function POST() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY niet ingesteld' }, { status: 400 })
  }

  // Gather data to synthesize memories from
  const [todos, finance, journal, habits, contacts] = await Promise.all([
    query<{ title: string; priority: string; completed: number }>(`SELECT title, priority, completed FROM todos ORDER BY created_at DESC LIMIT 20`).catch(() => []),
    query<{ type: string; category: string; amount: number }>(`SELECT type, category, SUM(amount) as amount FROM finance_items GROUP BY type, category ORDER BY amount DESC LIMIT 15`).catch(() => []),
    query<{ date: string; content: string; mood: number; energy: number }>(`SELECT TO_CHAR(date,'YYYY-MM-DD') as date, LEFT(content,300) as content, mood, energy FROM journal_entries ORDER BY date DESC LIMIT 5`).catch(() => []),
    query<{ name: string; logged_days: number }>(`SELECT h.name, COUNT(hl.id)::int as logged_days FROM habits h LEFT JOIN habit_logs hl ON hl.habit_id = h.id WHERE h.active = 1 GROUP BY h.name`).catch(() => []),
    query<{ name: string; company: string }>(`SELECT name, company FROM contacts ORDER BY created_at DESC LIMIT 10`).catch(() => []),
  ])

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je analyseert data van Daan (ondernemer/elektricien) en destilleert daaruit structurele feiten en patronen die de AI moet onthouden.

Geef een JSON-array terug van memories in dit formaat:
[
  { "key": "unieke_sleutel", "value": "wat er onthouden moet worden", "category": "personal_context|business_fact|work_pattern|preference|routine" }
]

Regels:
- Maximaal 10 memories
- Alleen feiten die waarschijnlijk stabiel blijven (geen tijdelijke zaken)
- Kies keys zonder spaties (gebruik underscores)
- Schrijf values in het Nederlands
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

Genereer nu de memory-array.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let memories: Array<{ key: string; value: string; category: string }> = []
  try {
    const parsed = JSON.parse(raw)
    memories = Array.isArray(parsed) ? parsed : (parsed.memories ?? parsed.data ?? [])
  } catch {
    return NextResponse.json({ error: 'AI gaf ongeldig JSON terug' }, { status: 500 })
  }

  let saved = 0
  for (const m of memories) {
    if (!m.key || !m.value) continue
    await execute(`
      INSERT INTO memory_log (key, value, category, confidence)
      VALUES ($1, $2, $3, 0.75)
      ON CONFLICT(key) DO UPDATE
        SET value = EXCLUDED.value, category = EXCLUDED.category, last_reinforced_at = NOW(), updated_at = NOW()
    `, [m.key, m.value, m.category ?? 'personal_context'])
    saved++
  }

  return NextResponse.json({ saved, total: memories.length })
}
