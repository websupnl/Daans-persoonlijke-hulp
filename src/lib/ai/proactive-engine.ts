/**
 * Proactive Engine — Tier 1 (Sentry) + Tier 2 (Sage)
 *
 * Tier 1 — Sentry: Pure JS anomaly detection using Life Snapshot.
 *   - Zero LLM calls. Fast, cheap.
 *   - Returns true/false: "is something worth saying?"
 *
 * Tier 2 — Sage: GPT-4o crafts a Telegram message.
 *   - Only triggered when Tier 1 fires.
 *   - Cross-pollinated insights, specific, actionable.
 */

import { getOpenAIClient } from './openai-client'
import { buildLifeSnapshot, formatSnapshotForPrompt, type LifeSnapshot, type AnomalyFlag } from './life-snapshot'
import { query, queryOne, execute } from '../db'
import { sendTelegramMessage } from '../telegram/send-message'

export interface ProactiveResult {
  triggered: boolean
  tier: 'none' | 'tier1_only' | 'tier2'
  anomalies: AnomalyFlag[]
  message?: string
  telegramSent: boolean
}

const NUDGE_COOLDOWN_HOURS: Record<string, number> = {
  finance_silence: 48,
  finance_anomaly: 24,
  open_invoices: 72,
  journal_silence: 36,
  overdue_todos: 24,
  stale_todos: 72,
  habit_streak: 24,
  inbox_overflow: 12,
  user_silence: 24,
  mood_decline: 48,
  workload_today: 12,
  finance_vague_items: 24,
}

/**
 * Run the full proactive analysis cycle.
 * Called by the hourly cron job at /api/cron/pulse
 */
export async function runProactiveEngine(): Promise<ProactiveResult> {
  const snap = await buildLifeSnapshot()

  if (snap.anomalies.length === 0) {
    // Clear resolved state for all topics if no anomalies are present
    await execute('UPDATE nudge_state SET resolved_at = NULL WHERE resolved_at IS NOT NULL')
    return { triggered: false, tier: 'none', anomalies: [], telegramSent: false }
  }

  // Clear resolved_at for topics that are no longer active
  const activeTopics = snap.anomalies.map(a => a.nudgeTopic)
  await execute(`
    UPDATE nudge_state 
    SET resolved_at = NULL 
    WHERE topic != ALL($1::text[]) AND resolved_at IS NOT NULL
  `, [activeTopics])

  // Filter out anomalies that were recently nudged (cooldown)
  const cooldownFiltered = await filterByCooldown(snap.anomalies)

  if (cooldownFiltered.length === 0) {
    return { triggered: false, tier: 'none', anomalies: snap.anomalies, telegramSent: false }
  }

  // Pick highest severity anomaly as the primary trigger
  const primary = cooldownFiltered.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })[0]

  // Tier 2: Craft message via LLM
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    // Fallback: send plain nudge without LLM
    const plainMessage = buildPlainNudge(primary, snap)
    return await sendAndLog(primary, cooldownFiltered, snap, plainMessage, 'tier1_only')
  }

  try {
    const message = await craftSageMessage(primary, cooldownFiltered, snap)
    return await sendAndLog(primary, cooldownFiltered, snap, message, 'tier2')
  } catch (err) {
    console.error('[ProactiveEngine] Sage LLM error:', err instanceof Error ? err.message : err)
    const plainMessage = buildPlainNudge(primary, snap)
    return await sendAndLog(primary, cooldownFiltered, snap, plainMessage, 'tier1_only')
  }
}

async function filterByCooldown(anomalies: AnomalyFlag[]): Promise<AnomalyFlag[]> {
  const result: AnomalyFlag[] = []
  for (const anomaly of anomalies) {
    const cooldownHours = NUDGE_COOLDOWN_HOURS[anomaly.nudgeTopic] ?? 24
    const state = await queryOne<{ last_nudged_at: string; resolved_at: string | null }>(
      'SELECT last_nudged_at, resolved_at FROM nudge_state WHERE topic = $1',
      [anomaly.nudgeTopic]
    )
    if (!state?.last_nudged_at) {
      result.push(anomaly)
      continue
    }
    if (state.resolved_at) continue // resolved, skip
    const hoursSince = (Date.now() - new Date(state.last_nudged_at).getTime()) / 3600000
    if (hoursSince >= cooldownHours) {
      result.push(anomaly)
    }
  }
  return result
}

async function sendAndLog(
  primary: AnomalyFlag,
  allTriggered: AnomalyFlag[],
  snap: LifeSnapshot,
  message: string,
  tier: 'tier1_only' | 'tier2'
): Promise<ProactiveResult> {
  let telegramSent = false

  const chatId = process.env.TELEGRAM_CHAT_ID
  if (chatId && message) {
    try {
      await sendTelegramMessage(
        parseInt(chatId, 10),
        message,
        {
          reply_markup: buildProactiveKeyboard(primary),
        }
      )
      telegramSent = true
    } catch (err) {
      console.error('[ProactiveEngine] Telegram send error:', err instanceof Error ? err.message : err)
    }
  }

  // Log to proactive_log
  await execute(`
    INSERT INTO proactive_log (trigger_type, trigger_details, message_sent, telegram_sent)
    VALUES ($1, $2, $3, $4)
  `, [
    primary.type,
    JSON.stringify({ anomalies: allTriggered, snapshot_summary: snap.anomalies.length }),
    message,
    telegramSent ? 1 : 0,
  ])

  // Update nudge_state for all triggered topics
  for (const anomaly of allTriggered) {
    await execute(`
      INSERT INTO nudge_state (topic, nudge_count, last_nudged_at, metadata)
      VALUES ($1, 1, NOW(), $2)
      ON CONFLICT(topic) DO UPDATE
        SET nudge_count = nudge_state.nudge_count + 1,
            last_nudged_at = NOW(),
            metadata = EXCLUDED.metadata
    `, [anomaly.nudgeTopic, JSON.stringify({ detail: anomaly.detail })])
  }

  return {
    triggered: true,
    tier,
    anomalies: allTriggered,
    message,
    telegramSent,
  }
}

function buildProactiveKeyboard(anomaly: AnomalyFlag) {
  const buttons: Array<{ text: string; callback_data: string }> = [
    { text: '✅ Begrepen', callback_data: `nudge_resolve:${anomaly.nudgeTopic}` },
    { text: '⏰ Herinner over 4u', callback_data: `nudge_snooze:${anomaly.nudgeTopic}:4` },
  ]

  if (anomaly.type === 'journal_silence') {
    buttons.push({ text: '📔 Schrijf nu', callback_data: 'journal_start' })
  } else if (anomaly.type === 'overdue_spike') {
    buttons.push({ text: '📋 Taken overzicht', callback_data: 'todos_overview' })
  } else if (anomaly.type === 'finance_silence' || anomaly.type === 'finance_anomaly') {
    buttons.push({ text: '💰 Financiën checken', callback_data: 'finance_overview' })
  }

  return { inline_keyboard: [buttons] }
}

function buildPlainNudge(anomaly: AnomalyFlag, _snap: LifeSnapshot): string {
  const labels: Record<string, string> = {
    finance_silence: '💰 Financiën',
    finance_anomaly: '💰 Financiële Uitschieter',
    journal_silence: '📔 Dagboek',
    overdue_spike: '📋 Achterstallige taken',
    habit_streak_break: '⭐ Gewoontes',
    inbox_overflow: '📥 Inbox',
    user_silence: '👋 Hey',
    mood_decline: '❤️ Check-in',
    workload_overload: '⚡ Werkdruk',
    stale_todo: '🔍 Oude taken',
    open_invoices_aging: '🧾 Openstaande facturen',
    vague_finance_items: '💰 Onduidelijke transacties',
  }

  const label = labels[anomaly.type] ?? '🧠 Melding'
  return `${label}\n\n${anomaly.detail}\n\n_Automatisch gegenereerd door je Personal Brain_`
}

/**
 * Tier 2: Sage — LLM crafts a smart, cross-pollinated Telegram message.
 */
async function craftSageMessage(
  primary: AnomalyFlag,
  allAnomalies: AnomalyFlag[],
  snap: LifeSnapshot
): Promise<string> {
  const openai = getOpenAIClient()
  const snapshotText = formatSnapshotForPrompt(snap)

  const theoriesText = snap.topTheories.length > 0
    ? '\n\nWat ik over jou weet (langetermijnpatronen):\n' +
      snap.topTheories.map(t => `- [${t.category}] ${t.theory}`).join('\n')
    : ''

  const systemPrompt = `Je bent Daan's Personal Brain — een intelligent systeem dat zijn leven analyseert en proactieve inzichten stuurt.
Daan is een drukke ondernemer/elektricien. Hij heeft weinig tijd. Jij bent zijn cognitieve verlengstuk.

Je stuurt nu een proactief Telegram-bericht gebaseerd op gedetecteerde anomalieën in zijn data.

REGELS:
- Maximaal 3-4 zinnen. Kort en krachtig.
- Combineer 2 modules als dat een scherper inzicht geeft (cross-pollination)
- Wees specifiek — gebruik echte getallen uit de snapshot. Als er financiële uitschieters of onduidelijke transacties zijn, noem dan specifiek de merchant name, het bedrag en de datum van de item(s).
- Niet vaag ("misschien moet je...") maar direct ("je hebt X — doe Y")
- Telegramformattering: *bold*, _italic_, geen HTML
- Sluit altijd af met één concrete actievraag. Stel specifieke vragen over vage financiële transacties (needs review/onbekende categorie), uitschieters of tegenpartijen als die in de snapshot/financiën naar voren komen.
- Toon: slim, betrokken, niet opdringerig. Zoals een goede compagnon die iets opmerkt.
- Schrijf in het Nederlands

PRIMAIRE TRIGGER: ${primary.type} — ${primary.detail}
ALLE ACTIEVE ANOMALIEËN: ${allAnomalies.map(a => a.detail).join(' | ')}
${theoriesText}`

  const userMessage = `Hier is de huidige life snapshot:\n\n${snapshotText}\n\nSchrijf nu één proactief Telegram-bericht voor Daan.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 300,
  })

  return response.choices[0]?.message?.content?.trim() ?? buildPlainNudge(primary, snap)
}

/**
 * Generate the "Stel me een vraag" deep-dive question.
 * Cross-pollinates two different modules for a surprising insight.
 */
export async function generateDeepQuestion(): Promise<string> {
  const snap = await buildLifeSnapshot()
  const openai = getOpenAIClient()

  if (!process.env.OPENAI_API_KEY) {
    return fallbackQuestion(snap)
  }

  const snapshotText = formatSnapshotForPrompt(snap)

  // Get recent journal entries for richer context
  const recentJournal = await query<{ date: string; content: string; mood: number }>(`
    SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, LEFT(content, 200) as content, mood
    FROM journal_entries ORDER BY date DESC LIMIT 5
  `).catch(() => [])

  const journalContext = recentJournal.length > 0
    ? '\n\nRecente dagboekentries:\n' + recentJournal.map(j => `[${j.date}, mood ${j.mood}] ${j.content}`).join('\n')
    : ''

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je bent een combinatie van drie experts die Daan kennen:
1. Klinisch psycholoog: herkent emotionele patronen, verdedigingsmechanismen, niet-uitgesproken conflicten
2. Stoïcijns filosoof: vraagt naar controle vs. acceptatie, principes, prioriteiten
3. High-performance executive coach: koppelt stemming/energie aan productiviteit en beslissingen

Genereer ÉÉN diepgravende persoonlijke vraag voor Daan. De vraag:
- Koppelt data uit TWEE verschillende modules (bijv. financiën + stemming, taken + gewoontes, werk + dagboek)
- Bevat een concrete observatie ("Ik zie dat X..." of "Je data laat Y zien...")
- Is verrassend — iets wat Daan zelf misschien niet heeft opgemerkt
- Is openhartig maar niet aanvallend
- Uitnodigend: wil zijn eerlijke reflectie

Schrijf in het Nederlands. Maximaal 3 zinnen.`,
      },
      {
        role: 'user',
        content: `${snapshotText}${journalContext}\n\nGenereer nu een diepgravende reflectievraag.`,
      },
    ],
    temperature: 0.9,
    max_tokens: 200,
  })

  return response.choices[0]?.message?.content?.trim() ?? fallbackQuestion(snap)
}

function fallbackQuestion(snap: LifeSnapshot): string {
  const questions = [
    `Ik merk dat je ${snap.daysSinceLastJournal} dagen niet hebt geschreven. Wat houdt je tegen — gebrek aan tijd, of misschien iets wat je liever niet onder ogen ziet?`,
    `Je hebt ${snap.overdueTodosCount} achterstallige taken. Zijn dit echt taken die je wilt doen, of zijn ze blijven hangen omdat ze ergens wrijving creëren?`,
    `Je stemming de laatste 7 dagen was gemiddeld ${snap.avgMood7Days ?? '?'}/5. Wat heeft de meeste invloed hierop gehad — werk, privé, of iets anders?`,
    `Je gewoontecompletie is ${Math.round(snap.habitCompletionRate7Days * 100)}%. Welke gewoonte sla je het vaakst over, en wat zegt dat over je prioriteiten op dit moment?`,
  ]
  return questions[Math.floor(Math.random() * questions.length)]
}

/**
 * Full Deep Sync — "State of the Union" for all modules.
 * Sends a comprehensive strategic report to Telegram.
 */
export async function runDeepSync(): Promise<string> {
  const snap = await buildLifeSnapshot()
  const openai = getOpenAIClient()

  if (!process.env.OPENAI_API_KEY) {
    return buildPlainDeepSync(snap)
  }

  // Get richer context for each module
  const [recentTodos, financeItems, recentJournal, theories] = await Promise.all([
    query<{ title: string; priority: string; due_date: string | null }>(`
      SELECT title, priority, TO_CHAR(due_date, 'YYYY-MM-DD') as due_date
      FROM todos WHERE completed = 0
      ORDER BY CASE priority WHEN 'hoog' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 10
    `),
    query<{ type: string; title: string; description: string | null; merchant_raw: string | null; user_notes: string | null; amount: number; status: string }>(`
      SELECT type, title, description, merchant_raw, user_notes, amount, status FROM finance_items
      WHERE created_at >= NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC LIMIT 10
    `),
    query<{ date: string; mood: number; energy: number; content: string }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, mood, energy, LEFT(content, 150) as content
      FROM journal_entries ORDER BY date DESC LIMIT 5
    `).catch(() => []),
    query<{ category: string; theory: string; confidence: number }>(`
      SELECT category, theory, confidence FROM ai_theories ORDER BY last_updated DESC LIMIT 5
    `).catch(() => []),
  ])

  const snapshotText = formatSnapshotForPrompt(snap)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Je bent Daan's Personal Brain. Je voert nu een volledige "State of the Union" uit.

Dit is een strategisch rapport over zijn hele leven: taken, financiën, dagboek, gewoontes, werk.

Structuur het rapport als volgt:
🧠 *Persoonlijk Brein Rapport*
_[datum]_

📋 *Taken*
[2-3 zinnen over urgentie, patroon, aanbeveling]

💰 *Financiën*
[2-3 zinnen over deze maand, openstaande facturen, trend]

📔 *Dagboek & Stemming*
[2-3 zinnen over stemming, energie, opvallend patroon]

⭐ *Gewoontes*
[1-2 zinnen over completie, wat ontbreekt]

🎯 *Top 3 Prioriteiten nu*
1. ...
2. ...
3. ...

💡 *Inzicht van de maand*
[1 cross-module observatie die Daan waarschijnlijk zelf nog niet heeft opgemerkt]

Schrijf in het Nederlands. Scherp, eerlijk, actionable.`,
      },
      {
        role: 'user',
        content: `Snapshot:\n${snapshotText}\n\nActieve taken:\n${recentTodos.map(t => `- [${t.priority}] ${t.title}${t.due_date ? ` (deadline: ${t.due_date})` : ''}`).join('\n')}\n\nFinanciën afgelopen 30d:\n${financeItems.map(f => `- ${f.type}: ${f.title}${f.description ? ` (${f.description})` : ''}${f.merchant_raw && f.merchant_raw !== f.title ? ` [raw: ${f.merchant_raw}]` : ''}${f.user_notes ? ` note: ${f.user_notes}` : ''} €${f.amount} (${f.status})`).join('\n')}\n\nDagboek:\n${recentJournal.map(j => `[${j.date}] mood:${j.mood} energie:${j.energy} — ${j.content}`).join('\n')}\n\nAI-theorieën:\n${theories.map(t => `[${t.category}] ${t.theory}`).join('\n')}`,
      },
    ],
    temperature: 0.6,
    max_tokens: 800,
  })

  const report = response.choices[0]?.message?.content?.trim() ?? buildPlainDeepSync(snap)

  // Log it
  await execute(`
    INSERT INTO proactive_log (trigger_type, trigger_details, message_sent, telegram_sent)
    VALUES ($1, $2, $3, $4)
  `, ['deep_sync', '{}', report, 0])

  return report
}

function buildPlainDeepSync(snap: LifeSnapshot): string {
  return `🧠 *Persoonlijk Brein Rapport*

📋 *Taken*: ${snap.openTodosCount} open, ${snap.overdueTodosCount} achterstallig, ${snap.highPriorityOpen} hoog-prio

💰 *Financiën*: €${Math.round(snap.monthIncomeTotal)} inkomsten / €${Math.round(snap.monthExpenseTotal)} uitgaven deze maand. ${snap.openInvoicesCount} openstaande facturen.

📔 *Dagboek*: ${snap.daysSinceLastJournal === 0 ? 'Vandaag geschreven ✓' : `${snap.daysSinceLastJournal} dagen geleden`}. Stemming gem.: ${snap.avgMood7Days ?? '?'}/5

⭐ *Gewoontes*: ${Math.round(snap.habitCompletionRate7Days * 100)}% completie afgelopen 7 dagen

📥 *Inbox*: ${snap.pendingInboxCount} onverwerkt`
}
