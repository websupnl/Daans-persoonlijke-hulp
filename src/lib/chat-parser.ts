/**
 * Rule-based Dutch/English NLP parser voor chat commands.
 * Herkent intenties en extraheert entiteiten zonder AI API.
 */

import { format, addDays, addWeeks, nextFriday, nextMonday, isValid } from 'date-fns'

export type Intent =
  | 'todo_add'
  | 'todo_complete'
  | 'todo_delete'
  | 'todo_list'
  | 'todo_update'
  | 'note_add'
  | 'note_list'
  | 'note_search'
  | 'contact_add'
  | 'contact_list'
  | 'contact_search'
  | 'finance_add_invoice'
  | 'finance_add_expense'
  | 'finance_add_income'
  | 'finance_list'
  | 'habit_log'
  | 'habit_list'
  | 'habit_query'
  | 'journal_open'
  | 'memory_add'
  | 'worklog_add'
  | 'worklog_query'
  | 'stats'
  | 'day_plan'
  | 'week_summary'
  | 'mood_query'
  | 'todo_query'
  | 'finance_query'
  | 'advice_request'
  | 'help'
  | 'unknown'

export interface ParsedIntent {
  intent: Intent
  confidence: number
  params: Record<string, string | number | boolean | undefined>
  raw: string
}

/** Intenties die een echte actie uitvoeren (vs vragen/analyse) */
export const COMMAND_INTENTS: Intent[] = [
  'todo_add', 'todo_complete', 'todo_delete', 'todo_update',
  'note_add', 'contact_add',
  'finance_add_invoice', 'finance_add_expense', 'finance_add_income',
  'habit_log', 'memory_add', 'worklog_add',
]

// ─── Datum extractie ──────────────────────────────────────────────────────────

export function extractDate(text: string): string | undefined {
  const lower = text.toLowerCase()
  const today = new Date()

  const patterns: Array<[RegExp, (m?: RegExpMatchArray) => Date]> = [
    [/\bvandaag\b|\btoday\b/, () => today],
    [/\bmorgen\b|\btomorrow\b/, () => addDays(today, 1)],
    [/\bovermorgen\b/, () => addDays(today, 2)],
    [/\bvolgende week\b|\bnext week\b/, () => addWeeks(today, 1)],
    [/\bvolgende maand\b|\bnext month\b/, () => addDays(today, 30)],
    [/\bmaandag\b|\bmonday\b/, () => nextMonday(today)],
    [/\bvrijdag\b|\bfriday\b/, () => nextFriday(today)],
    [/\bover (\d+) dagen?\b/, (m?: RegExpMatchArray) => addDays(today, parseInt(m?.[1] || '1'))],
    [/\bover (\d+) weken?\b/, (m?: RegExpMatchArray) => addWeeks(today, parseInt(m?.[1] || '1'))],
    [/\beinde (van de )?maand\b/, () => new Date(today.getFullYear(), today.getMonth() + 1, 0)],
    [/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/, (m?: RegExpMatchArray) => {
      if (!m) return today
      const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear()
      return new Date(year, parseInt(m[2]) - 1, parseInt(m[1]))
    }],
  ]

  for (const [pattern, getDate] of patterns) {
    const match = lower.match(pattern)
    if (match) {
      try {
        const date = getDate(match as RegExpMatchArray)
        if (isValid(date)) return format(date, 'yyyy-MM-dd')
      } catch { /* skip */ }
    }
  }
  return undefined
}

// ─── Prioriteit extractie ─────────────────────────────────────────────────────

export function extractPriority(text: string): 'hoog' | 'medium' | 'laag' {
  const lower = text.toLowerCase()
  if (/\b(urgent|asap|dringend|hoog|belangrijk|critical|snel|zo snel mogelijk|zsm)\b/.test(lower)) return 'hoog'
  if (/\b(laag|later|ooit|low|niet urgent|rustig)\b/.test(lower)) return 'laag'
  return 'medium'
}

// ─── Categorie extractie ──────────────────────────────────────────────────────

export function extractCategory(text: string): string {
  const lower = text.toLowerCase()
  if (/\b(factuur|betaling|invoice|geld|betaal|financ|bank|abonnement|hosting|kosten)\b/.test(lower)) return 'financieel'
  if (/\b(meeting|vergadering|werk|project|klant|client|offerte|voorstel|deadline)\b/.test(lower)) return 'werk'
  if (/\b(sport|sporten|gym|lopen|hardlopen|fietsen|zwemmen|bewegen|gezond)\b/.test(lower)) return 'gezondheid'
  if (/\b(boodschappen|eten|koken|schoonmaken|huis|thuis|wassen|opruimen)\b/.test(lower)) return 'persoonlijk'
  if (/\b(studie|leren|lezen|cursus|training|boek)\b/.test(lower)) return 'studie'
  return 'overig'
}

// ─── Worklog extractie ───────────────────────────────────────────────────────

export interface WorklogParams {
  duration_minutes?: number
  expected_duration_minutes?: number
  actual_duration_minutes?: number
  interruptions?: string
  raw_text: string
}

export function extractWorklogParams(text: string): WorklogParams {
  const lower = text.toLowerCase()

  let expectedMinutes: number | undefined
  let actualMinutes: number | undefined
  let durationMinutes: number | undefined

  // "dacht X uur, werd/duurde Y uur"
  const diffMatch = lower.match(/dacht.{0,15}(\d+(?:[,.]\d+)?)\s*(?:uur|u\b).{0,40}(?:werd|duurde|bleek).{0,15}(\d+(?:[,.]\d+)?)\s*(?:uur|u\b)/)
  if (diffMatch) {
    expectedMinutes = Math.round(parseFloat(diffMatch[1].replace(',', '.')) * 60)
    actualMinutes = Math.round(parseFloat(diffMatch[2].replace(',', '.')) * 60)
    durationMinutes = actualMinutes
  }

  // "van HH:MM tot HH:MM"
  if (!durationMinutes) {
    const timeRange = lower.match(/van\s+(\d{1,2}):(\d{2})\s+tot\s+(\d{1,2}):(\d{2})/)
    if (timeRange) {
      const startM = parseInt(timeRange[1]) * 60 + parseInt(timeRange[2])
      const endM = parseInt(timeRange[3]) * 60 + parseInt(timeRange[4])
      durationMinutes = endM > startM ? endM - startM : endM + 1440 - startM
      actualMinutes = durationMinutes
    }
  }

  // "X uur" or "X.5 uur"
  if (!durationMinutes) {
    const hoursM = lower.match(/(\d+(?:[,.]\d+)?)\s*(?:uur|u\b|h\b)/)
    if (hoursM) {
      durationMinutes = Math.round(parseFloat(hoursM[1].replace(',', '.')) * 60)
      actualMinutes = durationMinutes
    }
    const minsM = lower.match(/(\d+)\s*(?:min(?:uten?)?)/)
    if (minsM && !durationMinutes) {
      durationMinutes = parseInt(minsM[1])
      actualMinutes = durationMinutes
    }
  }

  // Interruptions: "door X", "omdat X langskwam/belde/crashte"
  const intMatch = text.match(/(?:door|vanwege|omdat|want)\s+([^.!?,]{4,60}?)(?:\s+(?:langs|kwamen?|belde?|crashte|onderbrak)|[.,!?]|$)/i)
  const interruptions = intMatch?.[1]?.trim()

  return {
    duration_minutes: durationMinutes,
    expected_duration_minutes: expectedMinutes,
    actual_duration_minutes: actualMinutes,
    interruptions,
    raw_text: text,
  }
}

// ─── Bedrag extractie ─────────────────────────────────────────────────────────

export function extractAmount(text: string): number | undefined {
  const match = text.match(/[€$]?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?/i)
  if (match) {
    return parseFloat(match[1].replace(',', '.'))
  }
  return undefined
}

// ─── Todo titel extractie ─────────────────────────────────────────────────────

function cleanTodoTitle(text: string): string {
  return text
    .replace(/\b(zet in todo|voeg toe aan todo|add to todo|todo:|herinner me om|remind me to|maak een todo voor|todo voor)\b/gi, '')
    .replace(/\b(urgent|asap|dringend|hoog prioriteit|laag prioriteit|morgen|vandaag|overmorgen|volgende week|volgende maand)\b/gi, '')
    .replace(/\bover \d+ (dagen?|weken?)\b/gi, '')
    .replace(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g, '')
    .replace(/[€$]\s*\d+(?:[.,]\d{1,2})?/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(om|to|voor|about|dat|die|de|het)\s+/i, '')
    .trim()
}

// ─── Hoofd parser ─────────────────────────────────────────────────────────────

export function parseIntent(input: string): ParsedIntent {
  const text = input.trim()
  const lower = text.toLowerCase()

  // ── Todo aanmaken ──
  if (
    /\b(zet in todo|voeg toe aan todo|todo:|add to todo|herinner me om|remind me to|maak.{0,10}todo|nieuwe taak|new task|taak:|task:)\b/i.test(text) ||
    /^todo:?\s+/i.test(text)
  ) {
    const title = cleanTodoTitle(text)
    return {
      intent: 'todo_add',
      confidence: 0.92,
      params: {
        title: title || text,
        priority: extractPriority(text),
        category: extractCategory(text),
        due_date: extractDate(text),
      },
      raw: text,
    }
  }

  // ── Todo completeren ──
  if (/\b(markeer.{0,20}als gedaan|markeer.{0,20}gedaan|klaar met|afgerond|heb.{0,10}gedaan|done|voltooid|afgevinkt|aftikken|geregeld|gefikst|gedaan)\b/i.test(text)) {
    const titleMatch = text.match(/(?:markeer|klaar met|afgerond|heb)\s+(.+?)(?:\s+als gedaan|$)/i)
    return {
      intent: 'todo_complete',
      confidence: 0.88,
      params: { query: titleMatch?.[1]?.trim() || '' },
      raw: text,
    }
  }

  // ── Todo verwijderen ──
  if (/\b(verwijder.{0,10}todo|delete.{0,10}todo|gooi weg|remove task|wis.{0,10}taak)\b/i.test(text)) {
    const titleMatch = text.match(/(?:verwijder|delete|gooi weg|wis)\s+(?:todo\s+)?(.+)/i)
    return {
      intent: 'todo_delete',
      confidence: 0.85,
      params: { query: titleMatch?.[1]?.trim() || '' },
      raw: text,
    }
  }

  // ── Todo lijst ──
  if (/\b(toon todos?|laat todos? zien|wat staat er open|open taken|mijn taken|todo lijst|todo list|show todos?|list todos?|overzicht taken|welke taken)\b/i.test(text)) {
    const filterMatch = text.match(/\b(vandaag|today|deze week|this week|overdue|te laat)\b/i)
    return {
      intent: 'todo_list',
      confidence: 0.9,
      params: { filter: filterMatch?.[0]?.toLowerCase() },
      raw: text,
    }
  }

  // ── Note aanmaken ──
  if (/\b(noteer|maak.{0,10}note|schrijf op|onthoud|sla op|new note|nieuwe note|note:|aantekening)\b/i.test(text)) {
    const content = text
      .replace(/\b(noteer|maak.{0,10}note?|schrijf op|onthoud|sla op|new note|nieuwe note|note:|aantekening:?)\b/gi, '')
      .trim()
    return {
      intent: 'note_add',
      confidence: 0.88,
      params: { content, title: content.slice(0, 60) },
      raw: text,
    }
  }

  // ── Note zoeken ──
  if (/\b(zoek.{0,10}note|find note|search note|zoek in notities)\b/i.test(text)) {
    const query = text.replace(/\b(zoek.{0,10}in\s*)?notities?\b|\bfind notes?\b|\bsearch notes?\b/gi, '').trim()
    return {
      intent: 'note_search',
      confidence: 0.85,
      params: { query },
      raw: text,
    }
  }

  // ── Note lijst ──
  if (/\b(toon notes?|mijn notities|laat notities zien|show notes?|list notes?|overzicht notities)\b/i.test(text)) {
    return { intent: 'note_list', confidence: 0.88, params: {}, raw: text }
  }

  // ── Contact aanmaken ──
  if (/\b(voeg contact toe|nieuw contact|new contact|add contact|contactpersoon toevoegen)\b/i.test(text)) {
    const nameMatch = text.match(/(?:contact|contactpersoon)\s+(?:toe\s+)?(.+?)(?:\s+(?:email|tel|telefoon|website).*)?$/i)
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    const phoneMatch = text.match(/(?:tel|telefoon|phone)[:\s]+(\+?[\d\s\-()]{8,})/i)
    return {
      intent: 'contact_add',
      confidence: 0.88,
      params: {
        name: nameMatch?.[1]?.trim(),
        email: emailMatch?.[1],
        phone: phoneMatch?.[1]?.trim(),
      },
      raw: text,
    }
  }

  // ── Contact lijst/zoeken ──
  if (/\b(toon contacten|mijn contacten|show contacts?|list contacts?|zoek contact|find contact)\b/i.test(text)) {
    const searchMatch = text.match(/(?:zoek|find)\s+contact\s+(.+)/i)
    return {
      intent: searchMatch ? 'contact_search' : 'contact_list',
      confidence: 0.85,
      params: { query: searchMatch?.[1]?.trim() },
      raw: text,
    }
  }

  // ── Factuur aanmaken ──
  if (/\b(factuur|invoice|stuur.{0,20}factuur|maak.{0,10}factuur|nieuwe factuur)\b/i.test(text)) {
    const amount = extractAmount(text)
    const clientMatch = text.match(/(?:voor|aan|naar|to|for)\s+([A-Za-z][A-Za-z0-9\s]{1,30}?)(?:\s+(?:voor|van|€|\d)|$)/i)
    return {
      intent: 'finance_add_invoice',
      confidence: 0.9,
      params: {
        title: text.slice(0, 80),
        amount,
        client: clientMatch?.[1]?.trim(),
        due_date: extractDate(text),
      },
      raw: text,
    }
  }

  // ── Uitgave loggen ──
  if (/\b(uitgave|uitgegeven|betaald|kosten|expense|heb betaald|heb uitgegeven)\b/i.test(text)) {
    const amount = extractAmount(text)
    const descMatch = text.match(/(?:voor|aan|for)\s+(.+?)(?:\s+[€\d]|$)/i)
    return {
      intent: 'finance_add_expense',
      confidence: 0.85,
      params: {
        title: descMatch?.[1]?.trim() || text.slice(0, 60),
        amount,
        category: extractCategory(text),
      },
      raw: text,
    }
  }

  // ── Inkomst loggen ──
  if (/\b(ontvangen|inkomst|betaling ontvangen|income|received|kreeg betaald)\b/i.test(text)) {
    const amount = extractAmount(text)
    return {
      intent: 'finance_add_income',
      confidence: 0.85,
      params: { title: text.slice(0, 60), amount },
      raw: text,
    }
  }

  // ── Worklog toevoegen ──
  // Detecteer: "X uur aan [project] gewerkt", "van HH:MM tot HH:MM", "dacht X uur werd Y uur"
  const hasWorkDuration = /\b(\d+(?:[,.]\d+)?)\s*(?:uur|u\b|h\b)/.test(lower)
  const hasWorkKeyword = /\b(gewerkt|bezig geweest|gecodeerd|gebouwd|ontworpen|bezig|sessie|gefocust|gedaan aan)\b/.test(lower)
  const hasTimeRange = /\bvan\s+\d{1,2}:\d{2}\s+tot\s+\d{1,2}:\d{2}\b/.test(lower)
  const hasExpectationDiff = /\bdacht.{0,15}\d.{0,30}(?:werd|duurde)\b/i.test(lower)

  if ((hasWorkDuration && hasWorkKeyword) || hasTimeRange || hasExpectationDiff) {
    const wlParams = extractWorklogParams(text)
    return {
      intent: 'worklog_add',
      confidence: 0.88,
      params: {
        ...wlParams,
        raw_text: text,
      },
      raw: text,
    }
  }

  // ── Worklog overzicht ──
  if (/\b(hoeveel uur|worklog|tijdregistratie|gewerkt vandaag|gewerkt deze week|focus score|mijn uren)\b/i.test(lower)) {
    return { intent: 'worklog_query', confidence: 0.87, params: {}, raw: text }
  }

  // ── Gewoonte loggen ──
  if (/\b(heb gesport|heb gelopen|heb gefietst|heb gezwommen|heb geoefend|log gewoonte|gewoonte gedaan|heb geslapen|goed geslapen|heb gemediteerd|heb gelezen)\b/i.test(text)) {
    const habitMatch = text.match(/\b(gesport|gelopen|gefietst|gezwommen|geoefend|geslapen|gemediteerd|gelezen)\b/i)
    return {
      intent: 'habit_log',
      confidence: 0.88,
      params: { habit_name: habitMatch?.[1] },
      raw: text,
    }
  }

  // ── Gewoonte vraag/analyse ──
  if (/\b(hoe gaan mijn gewoontes?|gewoontes? overzicht|hoe is mijn streak|toon gewoontes?|mijn gewoontes?|habit(s)? overzicht|hoe doe ik het met|streak overzicht)\b/i.test(lower)) {
    return { intent: 'habit_query', confidence: 0.9, params: {}, raw: text }
  }

  // ── Dagplan ──
  if (/\b(wat moet ik vandaag doen|dagplan|wat staat er vandaag|planning voor vandaag|focus vandaag|prioriteiten vandaag|wat zijn mijn priorities|what should i do today|today('s)? plan|day plan)\b/i.test(lower)) {
    return { intent: 'day_plan', confidence: 0.9, params: {}, raw: text }
  }

  // ── Week samenvatting ──
  if (/\b(week samenvatting|hoe ging deze week|weekly summary|week review|terugblik|this week('s)? summary|samenvatting van (de|deze) week)\b/i.test(lower)) {
    return { intent: 'week_summary', confidence: 0.88, params: {}, raw: text }
  }

  // ── Stemming/energie vraag ──
  if (/\b(hoe voel ik me|mijn stemming|mood check|hoe is mijn energie|hoe ga ik er(voor)?|hoe is het met me|hoe gaat het)\b/i.test(lower)) {
    return { intent: 'mood_query', confidence: 0.85, params: {}, raw: text }
  }

  // ── Taken analyse ──
  if (/\b(welke taken zijn urgent|wat zijn mijn priorities|todo analyse|taak overzicht|what('s)? urgent|mijn workload|hoeveel taken)\b/i.test(lower)) {
    return { intent: 'todo_query', confidence: 0.87, params: {}, raw: text }
  }

  // ── Financiën vraag ──
  if (/\b(financieel overzicht|mijn financiën|open facturen|openstaand|toon facturen|hoe staan mijn financiën|cashflow|financiële situatie|hoeveel verdien|hoe staat het financieel)\b/i.test(lower)) {
    return { intent: 'finance_query', confidence: 0.88, params: {}, raw: text }
  }

  // ── Dagboek ──
  if (/\b(dagboek|journal|dagelijkse log|schrijf in dagboek|open dagboek)\b/i.test(text)) {
    return { intent: 'journal_open', confidence: 0.88, params: {}, raw: text }
  }

  // ── Statistieken / dashboard ──
  if (/\b(statistieken|stats|dashboard|overzicht|samenvatting|summary)\b/i.test(text)) {
    return { intent: 'stats', confidence: 0.85, params: {}, raw: text }
  }

  // ── Geheugen opslaan ──
  if (/\b(onthoud dat|remember that|weet dat|sla op dat|nota bene|nb:|mijn.{1,20}is)\b/i.test(text)) {
    const factMatch = text.match(/(?:onthoud dat|remember that|weet dat|sla op dat)\s+(.+)/i)
    return {
      intent: 'memory_add',
      confidence: 0.82,
      params: { fact: factMatch?.[1]?.trim() || text },
      raw: text,
    }
  }

  // ── Advies ──
  if (/\b(geef me advies|wat zou jij doen|aanbeveling|tip|suggestie|hoe kan ik|what do you suggest|advise me|help me with)\b/i.test(lower)) {
    return { intent: 'advice_request', confidence: 0.8, params: {}, raw: text }
  }

  // ── Help ──
  if (/\b(help|wat kan je|what can you|commando's?|commands?|hoe gebruik|how to use)\b/i.test(text)) {
    return { intent: 'help', confidence: 0.95, params: {}, raw: text }
  }

  return { intent: 'unknown', confidence: 0, params: {}, raw: text }
}

// ─── Response generator voor eenvoudige commando's ───────────────────────────

export function generateResponse(intent: ParsedIntent, actionResult?: unknown): string {
  const { params } = intent

  switch (intent.intent) {
    case 'todo_add':
      if (actionResult) {
        const todo = actionResult as { id: number; title: string }
        return `✓ Todo aangemaakt: **"${todo.title}"**${params.priority === 'hoog' ? ' 🔴 hoog prioriteit' : ''}${params.due_date ? ` · deadline ${params.due_date}` : ''}`
      }
      return '✓ Todo aangemaakt!'

    case 'todo_complete':
      return `✓ Todo afgevinkt! Goed gedaan 💪`

    case 'todo_delete':
      return `🗑️ Todo verwijderd.`

    case 'todo_list': {
      const todos = actionResult as Array<{ title: string; priority: string; due_date?: string }> | undefined
      if (!todos || todos.length === 0) return '🎉 Geen open todos! Je bent helemaal bij.'
      const list = todos.slice(0, 8).map(t =>
        `• ${t.priority === 'hoog' ? '🔴' : t.priority === 'laag' ? '🟢' : '🟡'} ${t.title}${t.due_date ? ` _(${t.due_date})_` : ''}`
      ).join('\n')
      return `📋 **${todos.length} open todo${todos.length !== 1 ? 's' : ''}:**\n${list}${todos.length > 8 ? `\n_...en ${todos.length - 8} meer_` : ''}`
    }

    case 'note_add':
      return `📝 Note opgeslagen!`

    case 'note_list': {
      const notes = actionResult as Array<{ title: string }> | undefined
      if (!notes || notes.length === 0) return 'Nog geen notes. Typ "noteer ..." om je eerste note te maken.'
      return `📚 **${notes.length} notes** gevonden. Open de Notes module voor het volledige overzicht.`
    }

    case 'contact_add':
      return `👤 Contact **"${params.name || 'Nieuw contact'}"** toegevoegd!`

    case 'contact_list': {
      const contacts = actionResult as Array<{ name: string }> | undefined
      if (!contacts || contacts.length === 0) return 'Nog geen contacten.'
      return `👥 **${contacts.length} contacten** in je adresboek.`
    }

    case 'finance_add_invoice':
      return `🧾 Factuur aangemaakt${params.client ? ` voor **${params.client}**` : ''}${params.amount ? ` · €${params.amount}` : ''}. Ga naar Financiën om te bekijken.`

    case 'finance_add_expense':
      return `💸 Uitgave gelogd${params.amount ? `: €${params.amount}` : ''}.`

    case 'finance_add_income':
      return `💰 Inkomst geregistreerd${params.amount ? `: €${params.amount}` : ''}!`

    case 'finance_list': {
      const items = actionResult as { open: number; amount: number } | undefined
      if (items) return `📊 **${items.open} openstaande facturen** · totaal **€${items.amount.toFixed(2)}**`
      return `📊 Ga naar Financiën voor een volledig overzicht.`
    }

    case 'habit_log':
      return `✅ Gewoonte gelogd! ${params.habit_name ? `"${params.habit_name}"` : ''} Keep it up! 🔥`

    case 'journal_open':
      return `📖 Ga naar het Dagboek tabblad om je entry voor vandaag bij te houden.`

    case 'stats':
      return `📊 Hier is je overzicht:`

    case 'memory_add':
      return `🧠 Onthouden: "${params.fact}"`

    case 'worklog_add': {
      const dur = params.actual_duration_minutes || params.duration_minutes
      const durStr = dur ? `${Math.floor(Number(dur) / 60)}u${Number(dur) % 60 > 0 ? ` ${Number(dur) % 60}m` : ''}` : ''
      if (params.expected_duration_minutes && params.actual_duration_minutes && Number(params.actual_duration_minutes) > Number(params.expected_duration_minutes)) {
        const diff = Number(params.actual_duration_minutes) - Number(params.expected_duration_minutes)
        return `⏱️ Worklog opgeslagen${durStr ? ` (${durStr})` : ''}. ${Math.round(diff / 60 * 10) / 10}u langer dan verwacht${params.interruptions ? ` — onderbreking: ${params.interruptions}` : ''}.`
      }
      return `⏱️ Worklog opgeslagen${durStr ? ` · ${durStr}` : ''}${params.interruptions ? ` (⚠️ ${params.interruptions})` : ''}.`
    }

    case 'worklog_query':
      return `📊 Bekijk je worklog in het Worklog tabblad voor een volledig tijdoverzicht en focus score.`

    case 'help':
      return `**Wat ik kan doen:**

📋 **Todos**
• _"Zet in todo om factuur te sturen naar MCE"_
• _"Markeer factuur als gedaan"_
• _"Toon open todos"_

📝 **Notes**
• _"Noteer: idee voor nieuw project"_

👤 **Contacten**
• _"Voeg contact toe Jan Jansen"_

💰 **Financiën**
• _"Factuur voor MCE hosting €150"_
• _"Uitgave €45 voor kantoorspullen"_

🎯 **Gewoontes**
• _"Heb gesport vandaag"_

**Vragen stellen:**
• _"Wat moet ik vandaag doen?"_
• _"Hoe gaan mijn gewoontes?"_
• _"Hoe staan mijn financiën?"_
• _"Hoe ga ik ervoor?"_

⏱️ **Worklog**
• _"Ik heb 2 uur aan Prime Animals gewerkt"_
• _"Van 19:00 tot 22:00 Sjoeli"_
• _"Dacht 1 uur, werd 2 uur door buurman"_

🧠 **Geheugen**
• _"Onthoud dat mijn uurtarief €95 is"_`

    default:
      return `Hmm, dat begreep ik niet helemaal. Typ **help** voor een overzicht, of stel me een vraag over je gewoontes, todos of financiën.`
  }
}
