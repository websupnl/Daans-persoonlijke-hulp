/**
 * Pattern Brain — cross-module observatie, hypothesevorming en vraaggeneratie
 *
 * Laag 1: collectDailyObservations()  — slaat dagelijkse metrics op per module
 * Laag 2: detectAbsenceSignals()      — pure JS, detecteert wat ontbreekt vandaag
 * Laag 3: runDailyPatternAnalysis()   — GPT-4o cross-module hypotheses + vragen
 * Laag 4: runWeeklyPatternAnalysis()  — GPT-4o wekelijkse trends en verschuivingen
 */

import { query, queryOne, execute } from '@/lib/db'
import { getOpenAIClient } from '@/lib/ai/openai-client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AbsenceSignal {
  module: string
  signal: string
  severity: 'low' | 'medium' | 'high'
  detail: string
}

export interface PatternHypothesis {
  category: string
  theory: string
  confidence: number
  source_modules: string[]
  impact_score: number
  supporting_data?: string
}

export interface GeneratedQuestion {
  source_module: string
  theory_category?: string
  question: string
  rationale: string
  priority: number
  confidence: number
  impact_score: number
}

export interface DailyAnalysisResult {
  hypothesesUpdated: number
  questionsCreated: number
  absenceSignals: AbsenceSignal[]
}

export interface WeeklyAnalysisResult {
  insightsGenerated: number
  summary: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Laag 1: Dagelijkse observaties opslaan
// ─────────────────────────────────────────────────────────────────────────────

export async function collectDailyObservations(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)

  const [financeData, journalData, workData, habitData, todoData, notesData, projectsData] = await Promise.all([
    // Finance: dagelijkse totalen
    query<{ total_expenses: number; total_income: number; transaction_count: number }>(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'uitgave' THEN amount ELSE 0 END), 0)::float AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'inkomst' THEN amount ELSE 0 END), 0)::float AS total_income,
        COUNT(*)::int AS transaction_count
      FROM finance_items
      WHERE COALESCE(due_date, created_at::date) = $1
    `, [today]),

    // Journal: vandaag stemming en energie
    queryOne<{ mood: number | null; energy: number | null; has_entry: number }>(`
      SELECT mood, energy, 1 AS has_entry
      FROM journal_entries WHERE date = $1 LIMIT 1
    `, [today]),

    // Work: vandaag gewerkte minuten
    queryOne<{ total_minutes: number; session_count: number }>(`
      SELECT
        COALESCE(SUM(COALESCE(actual_duration_minutes, duration_minutes)), 0)::int AS total_minutes,
        COUNT(*)::int AS session_count
      FROM work_logs WHERE date = $1
    `, [today]),

    // Habits: completions vandaag
    queryOne<{ logged_today: number; total_active: number }>(`
      SELECT
        (SELECT COUNT(*) FROM habit_logs WHERE logged_date = $1)::int AS logged_today,
        (SELECT COUNT(*) FROM habits WHERE active = 1)::int AS total_active
    `, [today]),

    // Todos: afgerond en aangemaakt vandaag
    queryOne<{ completed_today: number; created_today: number; still_open: number }>(`
      SELECT
        (SELECT COUNT(*) FROM todos WHERE completed = 1 AND DATE(completed_at) = $1)::int AS completed_today,
        (SELECT COUNT(*) FROM todos WHERE DATE(created_at) = $1)::int AS created_today,
        (SELECT COUNT(*) FROM todos WHERE completed = 0)::int AS still_open
    `, [today]),

    // Notes: bijgewerkt/aangemaakt vandaag
    queryOne<{ updated_today: number; total_7d: number }>(`
      SELECT
        (SELECT COUNT(*) FROM notes WHERE DATE(updated_at) = $1)::int AS updated_today,
        (SELECT COUNT(*) FROM notes WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days')::int AS total_7d
    `, [today]),

    // Projects: actief + zonder recente notities
    queryOne<{ active_count: number; without_notes_3d: number }>(`
      SELECT
        (SELECT COUNT(*) FROM projects WHERE status = 'actief')::int AS active_count,
        (SELECT COUNT(*) FROM projects p WHERE status = 'actief'
          AND NOT EXISTS (
            SELECT 1 FROM notes n
            WHERE n.project_id = p.id AND n.updated_at >= CURRENT_DATE - INTERVAL '3 days'
          ))::int AS without_notes_3d
    `),
  ])

  // Sla alle metrics op (ON CONFLICT = update)
  const obs: Array<[string, string, number | null, string | null]> = [
    ['finance', 'total_expenses', financeData[0]?.total_expenses ?? 0, null],
    ['finance', 'total_income', financeData[0]?.total_income ?? 0, null],
    ['finance', 'transaction_count', financeData[0]?.transaction_count ?? 0, null],
    ['journal', 'has_entry', journalData ? 1 : 0, null],
    ['journal', 'mood', journalData?.mood ?? null, null],
    ['journal', 'energy', journalData?.energy ?? null, null],
    ['work', 'total_minutes', workData?.total_minutes ?? 0, null],
    ['work', 'session_count', workData?.session_count ?? 0, null],
    ['work', 'has_log', (workData?.session_count ?? 0) > 0 ? 1 : 0, null],
    ['habits', 'logged_today', habitData?.logged_today ?? 0, null],
    ['habits', 'total_active', habitData?.total_active ?? 0, null],
    ['habits', 'completion_rate',
      habitData?.total_active ? (habitData.logged_today / habitData.total_active) : null,
      null,
    ],
    ['todos', 'completed_today', todoData?.completed_today ?? 0, null],
    ['todos', 'created_today', todoData?.created_today ?? 0, null],
    ['todos', 'still_open', todoData?.still_open ?? 0, null],
    ['notes', 'updated_today', notesData?.updated_today ?? 0, null],
    ['notes', 'total_7d', notesData?.total_7d ?? 0, null],
    ['projects', 'active_count', projectsData?.active_count ?? 0, null],
    ['projects', 'without_notes_3d', projectsData?.without_notes_3d ?? 0, null],
  ]

  for (const [module, key, value, text] of obs) {
    await execute(`
      INSERT INTO pattern_observations (obs_date, module, metric_key, metric_value, metric_text)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (obs_date, module, metric_key) DO UPDATE
        SET metric_value = EXCLUDED.metric_value,
            metric_text = EXCLUDED.metric_text
    `, [today, module, key, value, text])
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Laag 2: Afwezigheidsdetectie — pure JS, geen LLM-kosten
// ─────────────────────────────────────────────────────────────────────────────

export async function detectAbsenceSignals(): Promise<AbsenceSignal[]> {
  const today = new Date().toISOString().slice(0, 10)
  const dayOfWeek = new Date().getDay() // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const hour = new Date().getHours()
  const signals: AbsenceSignal[] = []

  const [obs, recentWork, recentJournal, recentFinance] = await Promise.all([
    // Vandaag's observaties
    query<{ module: string; metric_key: string; metric_value: number }>(`
      SELECT module, metric_key, metric_value::float AS metric_value
      FROM pattern_observations WHERE obs_date = $1
    `, [today]),

    // Werklog: laatste 7 werkdagen
    query<{ date: string; total_minutes: number }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date,
             COALESCE(SUM(COALESCE(actual_duration_minutes, duration_minutes)), 0)::int AS total_minutes
      FROM work_logs
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY date ORDER BY date DESC
    `),

    // Dagboek: laatste invoer
    queryOne<{ days_ago: number }>(`
      SELECT (CURRENT_DATE - MAX(date))::int AS days_ago FROM journal_entries
    `),

    // Financiën: laatste invoer
    queryOne<{ days_ago: number }>(`
      SELECT (CURRENT_DATE - MAX(COALESCE(due_date, created_at::date)))::int AS days_ago FROM finance_items
    `),
  ])

  const obsMap = new Map(obs.map(o => [`${o.module}:${o.metric_key}`, o.metric_value]))

  // Werklog ontbreekt op weekdagen na 14:00
  if (hour >= 14 && dayOfWeek >= 1 && dayOfWeek <= 5) {
    const hasWorkToday = (obsMap.get('work:has_log') ?? 0) > 0
    if (!hasWorkToday) {
      // Specifieke check voor vrijdag + WebsUp
      if (dayOfWeek === 5) {
        signals.push({
          module: 'work',
          signal: 'vrijdag_websup_ontbreekt',
          severity: 'medium',
          detail: 'Normaal doe je op vrijdag iets voor WebsUp, maar vandaag zie ik nog geen activiteit.',
        })
      } else {
        // Kijk of de afgelopen 5 werkdagen wel logs hadden
        const workDaysWithLog = recentWork.filter(w => Number(w.total_minutes) > 0).length
        signals.push({
          module: 'work',
          signal: 'werklog_ontbreekt',
          severity: workDaysWithLog >= 3 ? 'medium' : 'low',
          detail: `Geen werklog voor vandaag terwijl het een werkdag is (${hour}:00u). Afgelopen week: ${workDaysWithLog}/5 dagen gelogd.`,
        })
      }
    }
  }

  // Dagboek ontbreekt al meerdere dagen of op specifieke dagen
  const journalDaysAgo = recentJournal?.days_ago ?? 999
  if (journalDaysAgo >= 3) {
    signals.push({
      module: 'journal',
      signal: 'dagboek_stilte',
      severity: journalDaysAgo >= 7 ? 'high' : 'medium',
      detail: `Je dagboek is leeg terwijl je het normaal vaker invult. Al ${journalDaysAgo} dagen geen invoer.`,
    })
  }

  // Financiën ontbreken lang of geen uitgaven vandaag (na 21:00)
  const financeDaysAgo = recentFinance?.days_ago ?? 999
  if (hour >= 21 && (obsMap.get('finance:transaction_count') ?? 0) === 0) {
    signals.push({
      module: 'finance',
      signal: 'geen_uitgaven_vandaag',
      severity: 'low',
      detail: 'Je hebt vandaag niets uitgegeven. Klopt dat, of ontbreekt er nog iets?',
    })
  }
  if (financeDaysAgo >= 10) {
    signals.push({
      module: 'finance',
      signal: 'financien_stilte',
      severity: financeDaysAgo >= 21 ? 'high' : 'medium',
      detail: `Geen financiële transacties in ${financeDaysAgo} dagen. Vergeten te importeren?`,
    })
  }

  // Gewoontes volledig overgeslagen vandaag (na 20:00)
  if (hour >= 20) {
    const loggedToday = obsMap.get('habits:logged_today') ?? 0
    const totalActive = obsMap.get('habits:total_active') ?? 0
    if (totalActive > 0 && loggedToday === 0) {
      signals.push({
        module: 'habits',
        signal: 'gewoontes_overgeslagen',
        severity: 'low',
        detail: `Vandaag nog geen gewoontes bijgehouden (0/${totalActive}).`,
      })
    }
  }

  return signals
}

// ─────────────────────────────────────────────────────────────────────────────
// Laag 3: Dagelijkse diepe analyse — GPT-4o
// ─────────────────────────────────────────────────────────────────────────────

export async function runDailyPatternAnalysis(): Promise<DailyAnalysisResult> {
  const absenceSignals = await detectAbsenceSignals()

  const [observations, journalEntries, financeItems, workLogs, habitLogs, existingTheories, personalRules, activeProjectsGaps] = await Promise.all([
    // Laatste 30 dagen observaties
    query<{ obs_date: string; module: string; metric_key: string; metric_value: number }>(`
      SELECT TO_CHAR(obs_date, 'YYYY-MM-DD') AS obs_date, module, metric_key,
             metric_value::float AS metric_value
      FROM pattern_observations
      WHERE obs_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY obs_date DESC, module, metric_key
    `),

    // Dagboekentries
    query<{ date: string; mood: number | null; energy: number | null; snippet: string }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, mood, energy,
             LEFT(content, 120) AS snippet
      FROM journal_entries
      ORDER BY date DESC LIMIT 14
    `),

    // Financiën: merchant patterns
    query<{ title: string; amount: number; category: string; transaction_date: string }>(`
      SELECT title, amount::float AS amount, category,
             COALESCE(due_date, created_at::date)::text AS transaction_date
      FROM finance_items
      WHERE type = 'uitgave'
        AND COALESCE(due_date, created_at::date) >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY transaction_date DESC LIMIT 40
    `),

    // Werklogs
    query<{ date: string; context: string; duration_minutes: number; energy_level: number | null }>(`
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, context,
             COALESCE(actual_duration_minutes, duration_minutes) AS duration_minutes,
             energy_level
      FROM work_logs
      ORDER BY date DESC LIMIT 20
    `),

    // Gewoontecompletions
    query<{ habit_name: string; logged_date: string }>(`
      SELECT h.name AS habit_name, TO_CHAR(hl.logged_date, 'YYYY-MM-DD') AS logged_date
      FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      WHERE hl.logged_date >= CURRENT_DATE - INTERVAL '14 days'
      ORDER BY hl.logged_date DESC LIMIT 30
    `),

    // Bestaande hypotheses (vermijd duplicaten)
    query<{ category: string; theory: string; confidence: number; status: string }>(`
      SELECT category, LEFT(theory, 100) AS theory, confidence::float, status
      FROM ai_theories
      ORDER BY last_updated DESC LIMIT 10
    `),

    // Persoonlijke regels
    query<{ rule_type: string; pattern: string; replacement: string }>(`
      SELECT rule_type, pattern, replacement FROM pattern_rules WHERE is_active = 1
    `),

    // Actieve projecten zonder recente notities (context gaps)
    query<{ title: string; days_since_note: number | null; open_todos: number }>(`
      SELECT p.title,
        (SELECT (CURRENT_DATE - MAX(n.updated_at::date))::int FROM notes n WHERE n.project_id = p.id) AS days_since_note,
        (SELECT COUNT(*)::int FROM todos t WHERE t.project_id = p.id AND t.completed = 0) AS open_todos
      FROM projects p
      WHERE p.status = 'actief'
      ORDER BY p.updated_at DESC LIMIT 8
    `).catch(() => []),
  ])

  // Bouw data-context op voor GPT
  const context = buildAnalysisContext(observations, journalEntries, financeItems, workLogs, habitLogs)
  const rulesText = (personalRules as any[] || []).map((r: any) => `- [${r.rule_type}] ${r.pattern} -> ${r.replacement}`).join('\n')

  // Context gap samenvatting voor projecten
  const projectGapsText = (activeProjectsGaps as Array<{ title: string; days_since_note: number | null; open_todos: number }>)
    .filter(p => p.days_since_note === null || p.days_since_note > 2)
    .map(p => `- "${p.title}": ${p.days_since_note != null ? `${p.days_since_note}d geen notitie` : 'nooit een notitie'}, ${p.open_todos} open taken`)
    .join('\n')

  const prompt = `Je bent de Pattern Recognition Engine van Daan's Persoonlijke Hulp.
  Analyseer de gedragsdata van Daan en genereer professionele OBSERVATIES, HYPOTHESES en VRAGEN.

  KERNTAAK:
  Leg cross-module verbanden (bijv. stemming vs uitgaven, tijdstip opstaan vs werkritme).
  Detecteer niet alleen wat er is, maar ook wat ONTBRREEKT of AFWIJKT.

  PERSOONLIJKE REGELS (pas deze toe bij analyse):
  ${rulesText || 'Geen'}

  STRUCTUUR:
  - Observatie: Feitelijke vaststelling uit de data.
  - Hypothese: Mogelijke verklaring of patroon (altijd met confidence score).
  - Vraag: Verificatie bij de gebruiker om een hypothese te bevestigen.

  REGELS:
  - Wees specifiek. Niet: "je geeft veel uit", maar: "Hypothese: op weken met lage stemming stijgen uitgaven aan vermoedelijke sigaretten."
  - Gebruik confidence scores (0.0 - 1.0).
  - Gebruik impact scores (0.0 - 1.0) voor hoe belangrijk dit inzicht is.
  - Identificeer actiepotentie: kan de gebruiker hier iets mee?
  - Geef category uit: financieel_gedrag / productiviteit / emotioneel_patroon / gewoonte / werk_privé / afwezigheid_signaal.

  CONTEXT GAP DETECTIE (speciaal aandacht):
  Kijk actief of er DATA ONTBREEKT die er wél zou moeten zijn:
  - Project actief maar geen notities afgelopen 3 dagen → vraag wat de laatste voortgang was
  - Werk gelogd maar geen journal → vraag hoe de dag echt was
  - Grote uitgave (>€50) maar geen journal vermelding → vraag of het gepland was
  - Actief project maar al >5 dagen geen taken afgerond → vraag of er blokkades zijn
  Genereer voor dit soort gaps een pending_question met hoge prioriteit (70-90).

  VOORBEELDEN TER INSPIRATIE:
  - "Je doet deze maand vaker kleine supermarktbezoeken dan normaal."
  - "Deze ronde €200 bij Jumbo lijkt niet op je normale boodschappenpatroon. Was dit contant opnemen?"
  - "Op dagen dat je later opstaat, log je minder vaak je werk."
  - "Vrijdagen lijken vaak WebsUp-dagen, maar vandaag zie ik nog weinig activiteit."
  - "In weken waarin je stemming lager is, zie ik ook minder structuur in werklog."
  - "Je hebt [Project] als actief staan maar ik zie al 4 dagen geen notities. Wat was de laatste stap?"
  - "Je hebt gisteren €67 bij [Merchant] uitgegeven, maar niets in je dagboek. Was dit gepland?"

  BESTAANDE HYPOTHESES (vermijd duplicaten of update ze):
  ${existingTheories.map(t => `- [${t.status}] [${t.category}] ${t.theory} (conf: ${t.confidence})`).join('\n') || 'Geen'}

  ACTIEVE PROJECTEN ZONDER RECENTE NOTITIES (context gaps — genereer hier vragen voor):
  ${projectGapsText || 'Geen gaps gedetecteerd'}

  DATA (Laatste 14-30 dagen):
  ${context}

  GEVRAAGD FORMAT (JSON):
  {
  "hypotheses": [
    {
      "category": "financieel_gedrag",
      "theory": "...",
      "confidence": 0.7,
      "impact_score": 0.8,
      "source_modules": ["journal", "finance"],
      "supporting_data": "Onderbouwing met cijfers uit de data...",
      "action_potential": "Bespaar potentieel X door Y"
    }
  ],
  "questions": [
    {
      "source_module": "finance",
      "theory_category": "financieel_gedrag",
      "question": "Was die €23 bij het tankstation voor sigaretten?",
      "rationale": "Dit bedrag komt vaak voor bij lagere stemming.",
      "priority": 80,
      "confidence": 0.6,
      "impact_score": 0.7
    }
  ]
  }`

  let hypothesesUpdated = 0
  let questionsCreated = 0

  if (!process.env.OPENAI_API_KEY) {
    return { hypothesesUpdated: 0, questionsCreated: 0, absenceSignals }
  }

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 900,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Je bent een data-analist die gedragspatronen detecteert. Je geeft alleen hypotheses die echt onderbouwd zijn door data. Je verzint niets.' },
        { role: 'user', content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      hypotheses?: PatternHypothesis[]
      questions?: GeneratedQuestion[]
    }

    // Sla hypotheses op
    for (const h of (parsed.hypotheses ?? []).slice(0, 4)) {
      if (!h.theory || !h.category) continue

      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM ai_theories WHERE category = $1 AND last_updated >= NOW() - INTERVAL '3 days' LIMIT 1`,
        [h.category]
      )

      if (existing) {
        await execute(`
          UPDATE ai_theories
          SET theory = $1, confidence = $2, impact_score = $3,
              source_modules = $4, status = 'hypothesis',
              action_potential = $5,
              last_updated = NOW(), times_confirmed = times_confirmed + 0
          WHERE id = $6
        `, [
          h.theory,
          Math.min(0.95, Math.max(0.1, h.confidence)),
          Math.min(1, Math.max(0, h.impact_score)),
          JSON.stringify(h.source_modules ?? []),
          (h as any).action_potential ?? null,
          existing.id,
        ])
      } else {
        await execute(`
          INSERT INTO ai_theories
            (category, theory, confidence, impact_score, source_modules, supporting_data, status, action_potential)
          VALUES ($1, $2, $3, $4, $5, $6, 'hypothesis', $7)
        `, [
          h.category,
          h.theory,
          Math.min(0.95, Math.max(0.1, h.confidence)),
          Math.min(1, Math.max(0, h.impact_score)),
          JSON.stringify(h.source_modules ?? []),
          h.supporting_data ?? null,
          (h as any).action_potential ?? null,
        ])
      }
      hypothesesUpdated++
    }

    // Sla vragen op — alleen als er geen soortgelijke al open staat
    for (const q of (parsed.questions ?? []).slice(0, 3)) {
      if (!q.question) continue

      // Voorkom dubbele vragen voor dezelfde module
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM pending_questions
         WHERE source_module = $1 AND status IN ('pending','sent')
           AND created_at >= NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [q.source_module]
      )
      if (existing) continue

      // Zoek bijbehorende theory_id
      const theory = q.theory_category
        ? await queryOne<{ id: number }>(
            `SELECT id FROM ai_theories WHERE category = $1 ORDER BY last_updated DESC LIMIT 1`,
            [q.theory_category]
          )
        : null

      await execute(`
        INSERT INTO pending_questions
          (source_module, theory_id, question, rationale, priority, confidence, impact_score)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        q.source_module,
        theory?.id ?? null,
        q.question,
        q.rationale ?? null,
        Math.min(100, Math.max(0, q.priority ?? 50)),
        Math.min(0.99, Math.max(0.1, q.confidence ?? 0.5)),
        Math.min(1, Math.max(0, q.impact_score ?? 0.5)),
      ])
      questionsCreated++
    }
  } catch (err) {
    console.error('[PatternEngine] Daily analysis error:', err instanceof Error ? err.message : err)
  }

  return { hypothesesUpdated, questionsCreated, absenceSignals }
}

// ─────────────────────────────────────────────────────────────────────────────
// Laag 4: Wekelijkse diepte-analyse — trends en gedragsveranderingen
// ─────────────────────────────────────────────────────────────────────────────

export async function runWeeklyPatternAnalysis(): Promise<WeeklyAnalysisResult> {
  // Vergelijk week N met week N-1
  const [thisWeek, lastWeek, theories] = await Promise.all([
    query<{ module: string; metric_key: string; avg_value: number }>(`
      SELECT module, metric_key, AVG(metric_value)::float AS avg_value
      FROM pattern_observations
      WHERE obs_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY module, metric_key
    `),
    query<{ module: string; metric_key: string; avg_value: number }>(`
      SELECT module, metric_key, AVG(metric_value)::float AS avg_value
      FROM pattern_observations
      WHERE obs_date >= CURRENT_DATE - INTERVAL '14 days'
        AND obs_date < CURRENT_DATE - INTERVAL '7 days'
      GROUP BY module, metric_key
    `),
    query<{ category: string; theory: string; confidence: number; status: string }>(`
      SELECT category, theory, confidence::float, status
      FROM ai_theories
      WHERE status IN ('hypothesis','confirmed')
      ORDER BY last_updated DESC LIMIT 8
    `),
  ])

  // Bouw vergelijking op
  const thisMap = new Map(thisWeek.map(r => [`${r.module}:${r.metric_key}`, r.avg_value]))
  const lastMap = new Map(lastWeek.map(r => [`${r.module}:${r.metric_key}`, r.avg_value]))

  const changes: string[] = []
  for (const [key, thisVal] of Array.from(thisMap.entries())) {
    const lastVal = lastMap.get(key)
    if (lastVal == null || lastVal === 0) continue
    const pct = ((thisVal - lastVal) / lastVal) * 100
    if (Math.abs(pct) >= 20) {
      const [module, metric] = key.split(':')
      const dir = pct > 0 ? 'gestegen' : 'gedaald'
      changes.push(`${module}/${metric}: ${dir} met ${Math.round(Math.abs(pct))}% (${lastVal.toFixed(1)} → ${thisVal.toFixed(1)})`)
    }
  }

  if (!process.env.OPENAI_API_KEY || (changes.length === 0 && theories.length === 0)) {
    return { insightsGenerated: 0, summary: 'Onvoldoende data voor wekelijkse analyse.' }
  }

  let insightsGenerated = 0
  let summary = ''

  try {
    const openai = getOpenAIClient()
    const prompt = `Je maakt een wekelijkse gedragsanalyse voor Daan.

WEEK-OVER-WEEK VERANDERINGEN (≥20% verschil):
${changes.length > 0 ? changes.join('\n') : 'Geen significante veranderingen'}

ACTIEVE HYPOTHESES:
${theories.map(t => `- [${t.status}] ${t.category}: ${t.theory}`).join('\n') || 'Geen'}

Geef in 3-5 bullet points (•) de belangrijkste wekelijkse inzichten.
Focus op: gedragsveranderingen, hypotheses die bevestigd/ontkracht lijken, kansen en risico's.
Wees voorzichtig — zeg "lijkt" of "mogelijk" bij onzekerheid.
Maximaal 150 woorden.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      temperature: 0.4,
      messages: [
        { role: 'system', content: 'Je bent een wekelijkse gedragsanalist. Beknopt, eerlijk, onderbouwd.' },
        { role: 'user', content: prompt },
      ],
    })

    summary = completion.choices[0]?.message?.content ?? ''

    // Sla op als wekelijks inzicht
    if (summary) {
      await execute(`
        INSERT INTO ai_theories (category, theory, confidence, impact_score, source_modules, status)
        VALUES ('wekelijks_inzicht', $1, 0.7, 0.6, '["alle_modules"]', 'hypothesis')
        ON CONFLICT DO NOTHING
      `, [summary.slice(0, 500)])
      insightsGenerated = 1
    }
  } catch (err) {
    console.error('[PatternEngine] Weekly analysis error:', err instanceof Error ? err.message : err)
  }

  return { insightsGenerated, summary }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildAnalysisContext(
  observations: Array<{ obs_date: string; module: string; metric_key: string; metric_value: number }>,
  journalEntries: Array<{ date: string; mood: number | null; energy: number | null; snippet: string }>,
  financeItems: Array<{ title: string; amount: number; category: string; transaction_date: string }>,
  workLogs: Array<{ date: string; context: string; duration_minutes: number; energy_level: number | null }>,
  habitLogs: Array<{ habit_name: string; logged_date: string }>
): string {
  const parts: string[] = []

  // Observaties samenvatten per module per week
  if (observations.length > 0) {
    const byModule = new Map<string, Array<{ date: string; key: string; val: number }>>()
    for (const o of observations) {
      const k = o.module
      if (!byModule.has(k)) byModule.set(k, [])
      byModule.get(k)!.push({ date: o.obs_date, key: o.metric_key, val: o.metric_value })
    }
    for (const [mod, rows] of Array.from(byModule.entries())) {
      const summary = rows.slice(0, 8).map((r: any) => `${r.date} ${r.key}=${r.val?.toFixed(1)}`).join(', ')
      parts.push(`[${mod.toUpperCase()}] ${summary}`)
    }
  }

  // Dagboek
  if (journalEntries.length > 0) {
    const jLines = journalEntries.slice(0, 8).map(j =>
      `${j.date} stemming=${j.mood ?? '?'} energie=${j.energy ?? '?'}: "${j.snippet?.slice(0, 60)}"`
    )
    parts.push('[DAGBOEK]\n' + jLines.join('\n'))
  }

  // Financiën: meest opvallende merchants
  if (financeItems.length > 0) {
    const merchantMap = new Map<string, number[]>()
    for (const f of financeItems) {
      const key = f.title.slice(0, 25).toLowerCase().trim()
      if (!merchantMap.has(key)) merchantMap.set(key, [])
      merchantMap.get(key)!.push(f.amount)
    }
    const topMerchants = Array.from(merchantMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8)
      .map(([name, amounts]) => `${name}: ${amounts.length}x (gem €${(amounts.reduce((a: number, b: number) => a + b) / amounts.length).toFixed(0)})`)
    parts.push('[FINANCIËN]\n' + topMerchants.join('\n'))
  }

  // Werklog
  if (workLogs.length > 0) {
    const wLines = workLogs.slice(0, 8).map(w =>
      `${w.date} ${w.context} ${w.duration_minutes}min energie=${w.energy_level ?? '?'}`
    )
    parts.push('[WERKLOG]\n' + wLines.join('\n'))
  }

  // Gewoontes
  if (habitLogs.length > 0) {
    const habitMap = new Map<string, number>()
    for (const h of habitLogs) {
      habitMap.set(h.habit_name, (habitMap.get(h.habit_name) ?? 0) + 1)
    }
    const hLines = Array.from(habitMap.entries()).map(([name, count]) => `${name}: ${count}x`)
    parts.push('[GEWOONTES]\n' + hLines.join('\n'))
  }

  return parts.join('\n\n')
}
