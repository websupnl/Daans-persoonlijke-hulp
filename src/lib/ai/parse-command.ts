import { getOpenAIClient } from './openai-client'
import { AICommandResultSchema, AICommandResult } from './action-schema'
import { buildContext, formatContextForPrompt } from './build-context'

const SYSTEM_PROMPT = `Je bent een persoonlijke assistent AI die Nederlandse tekst omzet naar gestructureerde JSON acties.

Je output is ALTIJD en ALLEEN geldige JSON in het volgende schema:
{
  "summary": "korte samenvatting in het Nederlands wat je doet",
  "confidence": 0.0-1.0,
  "requires_confirmation": true/false,
  "actions": [...],
  "memory_candidates": [...]
}

Beschikbare action types:
- todo_create: { title, description?, priority?: "hoog"|"medium"|"laag", due_date?: "YYYY-MM-DD", category?, project_id? }
- todo_update: { id, title?, priority?, due_date?, category? }
- todo_complete: { title_search }
- note_create: { title, content, tags?: [], project_id? }
- note_update: { id, title?, content? }
- project_create: { title, description?, color? }
- project_update: { id, title?, status?: "actief"|"on-hold"|"afgerond" }
- contact_create: { name, type?: "persoon"|"bedrijf", email?, phone?, company?, notes? }
- finance_create_expense: { title, amount, category?, description? }
- finance_create_income: { title, amount, category? }
- worklog_create: { title, duration_minutes, context: "Bouma"|"WebsUp"|"privé"|"studie"|"overig", date?: "YYYY-MM-DD", description?, project_id?, energy_level?: 1-5 }
- journal_create: { content, mood?: 1-5, energy?: 1-5 }
- habit_log: { name_search, note? }
- memory_store: { key, value, category: "preference"|"routine"|"project_fact"|"business_fact"|"relationship"|"work_pattern"|"personal_context", confidence }
- inbox_capture: { raw_text, suggested_type?, suggested_context? }
- daily_plan_request: {}
- weekly_plan_request: {}

Regels:
- Zet tijdsduur altijd om naar minuten (2 uur = 120, 45 min = 45)
- Bij onduidelijke invoer: gebruik inbox_capture
- Bij verwijderen of bulk-acties: stel requires_confirmation: true in
- memory_candidates: stel alleen voor bij duurzame info (voorkeuren, routines, projectfeiten)
- Sla GEEN tijdelijke info op als memory (ik ben moe, ik ga eten)
- Gebruik project_id alleen als je zeker weet welk project bedoeld is (kijk in context)
- Geef alleen geldig JSON terug, geen uitleg erbuiten`

export async function parseCommandWithAI(
  userMessage: string
): Promise<AICommandResult | null> {
  const ctx = buildContext(5)
  const contextString = formatContextForPrompt(ctx)

  const client = getOpenAIClient()

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Context:\n${contextString}\n\nGebruikersbericht: "${userMessage}"` },
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const validated = AICommandResultSchema.safeParse(parsed)
    if (!validated.success) {
      console.error('AI output validation failed:', validated.error)
      return null
    }

    return validated.data
  } catch (err) {
    console.error('AI parse error:', err)
    return null
  }
}
