import { addDays, addWeeks, format, isValid, nextFriday, nextMonday } from 'date-fns'

export type Intent =
  | 'todo_add'
  | 'todo_complete'
  | 'todo_delete'
  | 'todo_delete_all'
  | 'todo_list'
  | 'todo_update'
  | 'note_add'
  | 'note_list'
  | 'note_search'
  | 'contact_add'
  | 'contact_list'
  | 'contact_search'
  | 'project_add'
  | 'project_list'
  | 'finance_add_invoice'
  | 'finance_add_expense'
  | 'finance_add_income'
  | 'finance_list'
  | 'habit_log'
  | 'habit_list'
  | 'journal_open'
  | 'memory_add'
  | 'grocery_add'
  | 'grocery_list'
  | 'worklog_add'
  | 'worklog_list'
  | 'event_add'
  | 'event_list'
  | 'stats'
  | 'help'
  | 'unknown'

export interface ParsedIntent {
  intent: Intent
  confidence: number
  params: Record<string, string | number | boolean | undefined>
  raw: string
}

function normalize(text: string): string {
  let normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const typoFixes: Array<[RegExp, string]> = [
    [/\bvamdaag\b/g, 'vandaag'],
    [/\bvandaaf\b/g, 'vandaag'],
    [/\buitgegevenm\b/g, 'uitgegeven'],
    [/\bfinancienen\b/g, 'financien'],
    [/\bfinancieen\b/g, 'financien'],
    [/\bgewoontess?\b/g, 'gewoontes'],
    [/\bmemmory\b/g, 'memory'],
    [/\bwekrklog\b/g, 'werklog'],
  ]

  for (const [pattern, replacement] of typoFixes) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized
}

export function extractDate(text: string): string | undefined {
  const lower = normalize(text)
  const today = new Date()

  const patterns: Array<[RegExp, (m?: RegExpMatchArray) => Date]> = [
    [/\b(vandaag|today)\b/, () => today],
    [/\b(morgen|tomorrow)\b/, () => addDays(today, 1)],
    [/\b(overmorgen)\b/, () => addDays(today, 2)],
    [/\b(volgende week|next week|deze week)\b/, () => addWeeks(today, 1)],
    [/\b(volgende maand|next month)\b/, () => addDays(today, 30)],
    [/\b(maandag|monday)\b/, () => nextMonday(today)],
    [/\b(vrijdag|friday)\b/, () => nextFriday(today)],
    [/\bover (\d+) dagen?\b/, (m?: RegExpMatchArray) => addDays(today, parseInt(m?.[1] || '1', 10))],
    [/\bover (\d+) weken?\b/, (m?: RegExpMatchArray) => addWeeks(today, parseInt(m?.[1] || '1', 10))],
    [/\beinde (van de )?maand\b/, () => new Date(today.getFullYear(), today.getMonth() + 1, 0)],
    [/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/, (m?: RegExpMatchArray) => {
      if (!m) return today
      const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10)) : today.getFullYear()
      return new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10))
    }],
  ]

  for (const [pattern, getDate] of patterns) {
    const match = lower.match(pattern)
    if (!match) continue
    try {
      const date = getDate(match)
      if (isValid(date)) return format(date, 'yyyy-MM-dd')
    } catch {
      continue
    }
  }

  return undefined
}

export function extractPriority(text: string): 'hoog' | 'medium' | 'laag' {
  const lower = normalize(text)
  if (/\b(urgent|asap|dringend|hoog|belangrijk|critical|snel|zo snel mogelijk|zsm)\b/.test(lower)) return 'hoog'
  if (/\b(laag|later|ooit|low|niet urgent|rustig)\b/.test(lower)) return 'laag'
  return 'medium'
}

export function extractCategory(text: string): string {
  const lower = normalize(text)
  if (/\b(factuur|betaling|invoice|geld|betaal|financ|bank|abonnement|hosting|kosten)\b/.test(lower)) return 'financieel'
  if (/\b(meeting|vergadering|werk|project|klant|client|offerte|voorstel|deadline)\b/.test(lower)) return 'werk'
  if (/\b(sport|sporten|gym|lopen|hardlopen|fietsen|zwemmen|bewegen|gezond)\b/.test(lower)) return 'gezondheid'
  if (/\b(boodschappen|eten|koken|schoonmaken|huis|thuis|wassen|opruimen)\b/.test(lower)) return 'persoonlijk'
  if (/\b(studie|leren|lezen|cursus|training|boek)\b/.test(lower)) return 'studie'
  return 'overig'
}

export function extractAmount(text: string): number | undefined {
  const match = normalize(text).match(/[€$]?\s*(\d+(?:[.,]\d{1,2})?)\s*(?:euro|eur|€)?/i)
  if (!match) return undefined
  return parseFloat(match[1].replace(',', '.'))
}

function stripLeadingCommand(text: string, patterns: RegExp[]): string {
  let cleaned = text.trim()
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '').trim()
  }
  return cleaned.replace(/\s+/g, ' ').trim()
}

function cleanTodoTitle(text: string): string {
  return stripLeadingCommand(text, [
    /\b(zet in todo|voeg toe aan todo|add to todo|todo:|herinner me om|remind me to|maak een todo voor|maak todo|nieuwe taak|taak:|task:)\b/gi,
    /\b(urgent|asap|dringend|hoog prioriteit|lage prioriteit|morgen|vandaag|overmorgen|volgende week|volgende maand|deze week)\b/gi,
    /\bover \d+ (dagen?|weken?)\b/gi,
    /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/g,
    /[€$]\s*\d+(?:[.,]\d{1,2})?/g,
    /^(om|to|voor|about|dat|die|de|het)\s+/i,
  ])
}

function extractNameAfterKeyword(text: string, keywords: string[]): string {
  const pattern = new RegExp(`(?:${keywords.join('|')})\\s+(.+?)(?:\\s+(?:aan|toe|met|email|mail|tel|telefoon|phone|website|bedrijf|notitie|notes?)\\b|$)`, 'i')
  return text.match(pattern)?.[1]?.trim() || ''
}

function extractProjectTitle(text: string): string {
  return stripLeadingCommand(text, [
    /\b(maak|voeg)\b/gi,
    /\b(project|website|site)\b/gi,
    /\b(aan|toe)\b/gi,
  ])
}

export function parseIntent(input: string): ParsedIntent {
  const text = input.trim()
  const lower = normalize(text)

  if (/^(hey|hoi|hallo|yo|goedemorgen|goedemiddag|goedenavond)\b/.test(lower)) {
    return { intent: 'unknown', confidence: 0.2, params: { greeting: true }, raw: text }
  }

  if (/\b(help|wat kan je|what can you|commando'?s?|commands?|hoe gebruik|how to use)\b/.test(lower)) {
    return { intent: 'help', confidence: 0.95, params: {}, raw: text }
  }

  if (/\b(statistieken|stats|dashboard|samenvatting|summary|hoe gaat het)\b/.test(lower)) {
    return { intent: 'stats', confidence: 0.85, params: {}, raw: text }
  }

  if (/\b(toon|laat|geef|welke|wat)\b.*\bagenda\b|\bagenda (vandaag|deze week|komende)\b|\btoon deze week\b|\b(wat heb ik|wat moet ik)\b.*\b(vandaag|morgen|vrijdag|maandag|dinsdag|woensdag|donderdag|zaterdag|zondag)\b/.test(lower)) {
    const filterMatch = lower.match(/\b(vandaag|deze week|komende|morgen|vrijdag|maandag|dinsdag|woensdag|donderdag|zaterdag|zondag)\b/)
    return {
      intent: 'event_list',
      confidence: 0.95,
      params: { filter: filterMatch?.[1] || 'deze week' },
      raw: text,
    }
  }

  if (/\b(toon|laat|geef|welke|wat)\b.*\b(open )?todos?\b|\b(open taken|mijn taken|todo lijst|todo list|list todos?)\b/.test(lower)) {
    const filterMatch = lower.match(/\b(vandaag|today|deze week|this week|overdue|te laat|afgerond|completed)\b/)
    return {
      intent: 'todo_list',
      confidence: 0.95,
      params: { filter: filterMatch?.[1] || (lower.includes('open') ? 'open' : undefined) },
      raw: text,
    }
  }

  if (/\b(verwijder|wis|gooi weg|leeg)\b.*\b(hele|gehele|alle)\b.*\b(todo|todos|taken|todolijst)\b/.test(lower)) {
    return { intent: 'todo_delete_all', confidence: 0.97, params: {}, raw: text }
  }

  if (/\b(zoek.{0,10}note|find note|search note|zoek in notities)\b/.test(lower)) {
    const query = text.replace(/\b(zoek.{0,10}in\s*)?notities?\b|\bfind notes?\b|\bsearch notes?\b/gi, '').trim()
    return { intent: 'note_search', confidence: 0.85, params: { query }, raw: text }
  }

  if (/\b(toon notes?|mijn notities|laat notities zien|show notes?|list notes?|overzicht notities)\b/.test(lower)) {
    return { intent: 'note_list', confidence: 0.9, params: {}, raw: text }
  }

  if (/\b(toon contacten|mijn contacten|show contacts?|list contacts?|zoek contact|find contact)\b/.test(lower)) {
    const searchMatch = text.match(/(?:zoek|find)\s+contact\s+(.+)/i)
    return {
      intent: searchMatch ? 'contact_search' : 'contact_list',
      confidence: 0.88,
      params: { query: searchMatch?.[1]?.trim() },
      raw: text,
    }
  }

  if (/\b(toon projecten|mijn projecten|show projects?|list projects?)\b/.test(lower)) {
    return { intent: 'project_list', confidence: 0.88, params: {}, raw: text }
  }

  if (/\b(financieel overzicht|mijn financien|mijn financienen|open facturen|openstaand|toon facturen|toon mijn financien|show invoices|toon financien)\b/.test(lower)) {
    return { intent: 'finance_list', confidence: 0.93, params: {}, raw: text }
  }

  if (/\b(hoeveel|wat)\b.*\b(uitgegeven|uitgaven|besteed)\b|\bwat heb ik vandaag uitgegeven\b/.test(lower)) {
    return {
      intent: 'finance_list',
      confidence: 0.96,
      params: { filter: lower.includes('vandaag') ? 'today_expenses' : 'expenses' },
      raw: text,
    }
  }

  if (/\b(gewoontes?|habits?|toon gewoontes?|mijn gewoontes?|streak)\b/.test(lower)) {
    return { intent: 'habit_list', confidence: 0.9, params: {}, raw: text }
  }

  if (/\b(toon werklogs?|mijn werklogs?|hoeveel gewerkt|werkuren|vandaag gewerkt|werklog overzicht)\b/.test(lower)) {
    return { intent: 'worklog_list', confidence: 0.9, params: {}, raw: text }
  }

  if (/\b(dagboek|journal|dagelijkse log|schrijf in dagboek|open dagboek)\b/.test(lower)) {
    return { intent: 'journal_open', confidence: 0.9, params: {}, raw: text }
  }

  if (/\b(toon|laat|geef|welke|wat)\b.*\b(boodschappen|boodschappenlijst|grocery|groceries)\b|\bboodschappenlijstje?\b/.test(lower)) {
    return { intent: 'grocery_list', confidence: 0.95, params: {}, raw: text }
  }

  if (/\b(voeg.{0,10}toe aan boodschappen|zet.{0,10}op boodschappenlijst|koop|boodschap:|boodschappen:)\b/i.test(text) || /\b(is op|zijn op|moet op het lijstje)\b/i.test(text)) {
    const title = text
      .replace(/\b(voeg.{0,10}toe aan boodschappen|zet.{0,10}op boodschappenlijst|koop|boodschap:|boodschappen:|boodschappenlijstje?|is op|zijn op|moet op het lijstje)\b/gi, '')
      .trim()
    return {
      intent: 'grocery_add',
      confidence: 0.9,
      params: { title: title || text },
      raw: text,
    }
  }

  if (
    /\b(zet in todo|voeg toe aan todo|todo:|add to todo|herinner me om|remind me to|maak.{0,15}todo|nieuwe taak|new task|taak:|task:)\b/i.test(text) ||
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

  if (/\b(markeer.{0,20}als gedaan|markeer.{0,20}gedaan|klaar met|afgerond|heb.{0,10}gedaan|done|voltooid|afgevinkt|aftikken|geregeld|gefikst|gedaan)\b/i.test(text)) {
    const titleMatch = text.match(/(?:markeer|klaar met|afgerond|heb)\s+(.+?)(?:\s+als gedaan|$)/i)
    return {
      intent: 'todo_complete',
      confidence: 0.88,
      params: { query: titleMatch?.[1]?.trim() || '' },
      raw: text,
    }
  }

  if (/\b(verwijder.{0,20}todo|delete.{0,20}todo|gooi weg|remove task|wis.{0,20}taak)\b/i.test(text)) {
    const titleMatch = text.match(/(?:verwijder|delete|gooi weg|wis)\s+(?:todo\s+)?(.+)/i)
    return {
      intent: 'todo_delete',
      confidence: 0.88,
      params: { query: titleMatch?.[1]?.trim() || '' },
      raw: text,
    }
  }

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

  if (/\b(voeg contact toe|nieuw contact|new contact|add contact|contactpersoon toevoegen|maak contact .* aan)\b/i.test(text)) {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    const phoneMatch = text.match(/(?:tel|telefoon|phone)[:\s]+(\+?[\d\s\-()]{8,})/i)
    const name = extractNameAfterKeyword(text, ['voeg contact toe', 'nieuw contact', 'add contact', 'maak contact', 'contactpersoon'])
    return {
      intent: 'contact_add',
      confidence: 0.9,
      params: {
        name,
        email: emailMatch?.[1],
        phone: phoneMatch?.[1]?.trim(),
      },
      raw: text,
    }
  }

  if (/\b(maak|voeg).{0,15}(project|website|site).{0,10}(aan|toe)\b/i.test(text)) {
    return {
      intent: 'project_add',
      confidence: 0.9,
      params: { title: extractProjectTitle(text) || text },
      raw: text,
    }
  }

  if (/\b(factuur|invoice|stuur.{0,20}factuur|maak.{0,10}factuur|nieuwe factuur)\b/i.test(text)) {
    const amount = extractAmount(text)
    const clientMatch = text.match(/(?:voor|aan|naar|to|for)\s+([A-Za-z][A-Za-z0-9\s]{1,30}?)(?:\s+(?:voor|van|€|\d)|$)/i)
    const descMatch = text.match(/(?:voor|for)\s+(.+?)(?:\s+(?:van|€|\d+)|$)/i)
    return {
      intent: 'finance_add_invoice',
      confidence: 0.9,
      params: {
        title: text.slice(0, 80),
        amount,
        client: clientMatch?.[1]?.trim(),
        description: descMatch?.[1]?.trim(),
        due_date: extractDate(text),
      },
      raw: text,
    }
  }

  if (
    /\b(uitgave|uitge[a-z]+|betaald|kosten|expense|heb betaald|besteed|gespendeerd|gekost)\b/i.test(text) ||
    /\b(zonet|net|vandaag|gisteren)\b.{0,30}\b(euro|eur|€|\d+)\b/i.test(text) ||
    /\b(euro|eur|€|\d+)\b.{0,30}\b(aan|voor|bij|op)\b/i.test(text)
  ) {
    const amount = extractAmount(text)
    const descMatch = text.match(/(?:voor|aan|bij|op)\s+(.{3,60})$/i) || text.match(/\d+\s*(?:euro|eur|€)?\s+(.{3,60})$/i)
    return {
      intent: 'finance_add_expense',
      confidence: 0.83,
      params: {
        title: descMatch?.[1]?.trim() || text.slice(0, 60),
        amount,
        category: extractCategory(text),
      },
      raw: text,
    }
  }

  if (/\b(ontvangen|inkomst|betaling ontvangen|income|received|kreeg betaald)\b/i.test(text)) {
    const amount = extractAmount(text)
    return {
      intent: 'finance_add_income',
      confidence: 0.85,
      params: { title: text.slice(0, 60), amount },
      raw: text,
    }
  }

  if (/\b(heb gesport|heb gelopen|heb gefietst|heb gezwommen|heb geoefend|log gewoonte|gewoonte gedaan|heb geslapen|goed geslapen|ik heb gelezen|water gedronken|gedronken water|genoeg water)\b/i.test(text)) {
    const habitMatch = normalize(text).match(/\b(gesport|gelopen|gefietst|gezwommen|geoefend|geslapen|gemediteerd|gelezen|water)\b/i)
    return {
      intent: 'habit_log',
      confidence: 0.85,
      params: { habit_name: habitMatch?.[1] },
      raw: text,
    }
  }

  if (/\b(onthoud dat|remember that|weet dat|sla op dat|nota bene|nb:|mijn.{1,20}is)\b/i.test(text)) {
    const factMatch = text.match(/(?:onthoud dat|remember that|weet dat|sla op dat)\s+(.+)/i)
    return {
      intent: 'memory_add',
      confidence: 0.82,
      params: { fact: factMatch?.[1]?.trim() || text },
      raw: text,
    }
  }

  if (
    /\b(gewerkt aan|heb gewerkt|werklog|uren gelogd?|gelogd|time log|tijdlog|heb.{0,20}uur.{0,20}gewerkt|heb.{0,20}min.{0,20}gewerkt)\b/i.test(text) ||
    /\b\d+[.,]?\d*\s*(uur|u|h|uren|min|minuten|minuut)\b.{0,30}\b(aan|bij|voor|op|gewerkt|gesleuteld|gebouwd|geschreven|gecoded|gemaild|gebeld)\b/i.test(text)
  ) {
    const durationMatch = text.match(/(\d+)[.,]?(\d*)\s*(uur|u|h|uren)/i) || text.match(/(\d+)\s*(min|minuten|minuut)/i)
    let duration: number | undefined
    if (durationMatch) {
      if (/uur|u|h|uren/i.test(durationMatch[3] ?? '')) {
        duration = parseInt(durationMatch[1], 10) * 60 + (durationMatch[2] ? parseInt(durationMatch[2], 10) * 6 : 0)
      } else {
        duration = parseInt(durationMatch[1], 10)
      }
    }

    const contextMatch = normalize(text).match(/\b(bouma|websup|webdesign|prive|studie)\b/)
    const contextMap: Record<string, string> = { bouma: 'Bouma', websup: 'WebsUp', webdesign: 'WebsUp', prive: 'prive', studie: 'studie' }

    return {
      intent: 'worklog_add',
      confidence: 0.85,
      params: {
        title: text.slice(0, 80),
        duration_minutes: duration,
        context: contextMatch ? contextMap[contextMatch[1]] : undefined,
      },
      raw: text,
    }
  }

  if (/\b(agenda|event|afspraak|vergadering|meeting|deadline|herinnering|reminder|zet in agenda|plan.{0,15}in|afgesproken met|gepland)\b/i.test(text)) {
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\b/)
    const typeMatch = normalize(text).match(/\b(vergadering|meeting|call|deadline|afspraak|herinnering|reminder)\b/)
    const typeMap: Record<string, string> = {
      vergadering: 'vergadering',
      meeting: 'vergadering',
      call: 'vergadering',
      deadline: 'deadline',
      afspraak: 'afspraak',
      herinnering: 'herinnering',
      reminder: 'herinnering',
    }

    return {
      intent: 'event_add',
      confidence: 0.85,
      params: {
        title: stripLeadingCommand(text, [/\b(agenda|event|zet in agenda|plan in|gepland|vergadering|meeting|afspraak|deadline|herinnering)\b/gi]).slice(0, 80) || text.slice(0, 80),
        date: extractDate(text) || new Date().toISOString().split('T')[0],
        time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : undefined,
        type: typeMatch ? typeMap[typeMatch[1]] || 'algemeen' : 'algemeen',
      },
      raw: text,
    }
  }

  return { intent: 'unknown', confidence: 0, params: {}, raw: text }
}

export function generateResponse(intent: ParsedIntent, actionResult?: unknown): string {
  const { params } = intent

  switch (intent.intent) {
    case 'todo_add': {
      const todo = actionResult as { title?: string } | undefined
      return `Todo aangemaakt: "${todo?.title || params.title || 'Nieuwe taak'}"`
    }
    case 'todo_complete':
      return 'Todo afgevinkt.'
    case 'todo_delete':
      return 'Todo verwijderd.'
    case 'todo_delete_all':
      return 'Je todolijst is leeggemaakt.'
    case 'todo_list': {
      const todos = actionResult as Array<{ title: string; priority: string; due_date?: string }> | undefined
      if (!todos || todos.length === 0) return 'Geen todos gevonden.'
      const list = todos.slice(0, 8).map((t) => `• ${t.title}${t.due_date ? ` (${t.due_date})` : ''}`).join('\n')
      return `${todos.length} todo${todos.length === 1 ? '' : 's'}:\n${list}`
    }
    case 'note_add':
      return 'Note opgeslagen.'
    case 'note_list': {
      const notes = actionResult as Array<{ title: string }> | undefined
      return !notes?.length ? 'Geen notes gevonden.' : `${notes.length} notes gevonden.`
    }
    case 'contact_add':
      return `Contact "${params.name || 'Nieuw contact'}" toegevoegd.`
    case 'contact_list': {
      const contacts = actionResult as Array<{ name: string }> | undefined
      return !contacts?.length ? 'Geen contacten gevonden.' : `${contacts.length} contacten gevonden.`
    }
    case 'project_add':
      return `Project "${params.title || 'Nieuw project'}" aangemaakt.`
    case 'project_list': {
      const projects = actionResult as Array<{ title: string }> | undefined
      return !projects?.length ? 'Geen projecten gevonden.' : `${projects.length} projecten gevonden.`
    }
    case 'finance_add_invoice':
      return `Factuur aangemaakt${params.amount ? ` voor EUR ${params.amount}` : ''}.`
    case 'finance_add_expense':
      return `Uitgave gelogd${params.amount ? `: EUR ${params.amount}` : ''}.`
    case 'finance_add_income':
      return `Inkomst geregistreerd${params.amount ? `: EUR ${params.amount}` : ''}.`
    case 'finance_list': {
      const items = actionResult as { open?: number; amount?: number; spent_today?: number } | undefined
      if (typeof items?.spent_today === 'number') return `Vandaag heb je EUR ${Number(items.spent_today || 0).toFixed(2)} uitgegeven.`
      return items ? `${items.open} openstaande facturen, totaal EUR ${Number(items.amount || 0).toFixed(2)}.` : 'Ga naar Financien voor het overzicht.'
    }
    case 'habit_log':
      return `Gewoonte gelogd${params.habit_name ? `: ${params.habit_name}` : ''}.`
    case 'habit_list':
      return 'Je gewoontes staan in het Gewoontes-tabblad.'
    case 'journal_open':
      return 'Dagboek geopend voor vandaag.'
    case 'stats':
      return 'Hier is je overzicht:'
    case 'memory_add':
      return `Onthouden: "${params.fact}"`
    case 'grocery_add': {
      const item = actionResult as { title?: string } | undefined
      return `Boodschap toegevoegd: "${item?.title || params.title}"`
    }
    case 'grocery_list': {
      const items = actionResult as Array<{ title: string; quantity?: string }> | undefined
      if (!items || items.length === 0) return 'Je boodschappenlijst is leeg.'
      const list = items.map((i) => `• ${i.title}${i.quantity ? ` (${i.quantity})` : ''}`).join('\n')
      return `Boodschappenlijst:\n${list}`
    }
    case 'worklog_add': {
      const log = actionResult as { title?: string; duration_minutes?: number } | undefined
      return `Werklog opgeslagen: "${log?.title || params.title || 'Werklog'}"`
    }
    case 'worklog_list': {
      const result = actionResult as { total_minutes: number; count: number } | undefined
      if (!result?.count) return 'Geen werklogs gevonden voor vandaag.'
      return `${result.count} werklogs vandaag, totaal ${result.total_minutes} minuten.`
    }
    case 'event_add': {
      const ev = actionResult as { title: string; date: string; time?: string } | undefined
      return `Event aangemaakt: "${ev?.title || params.title}" op ${ev?.date || params.date}${ev?.time ? ` om ${ev.time}` : ''}`
    }
    case 'event_list': {
      const result = actionResult as { events?: Array<{ title: string; date: string; time?: string }>; todos?: Array<{ title: string; due_date?: string }> } | Array<{ title: string; date: string; time?: string }> | undefined
      const events = Array.isArray(result) ? result : (result?.events || [])
      const todos = Array.isArray(result) ? [] : (result?.todos || [])
      if (!events.length && !todos.length) return 'Geen geplande dingen gevonden.'
      const lines = [
        ...events.map((e) => `• ${e.date}${e.time ? ` ${e.time}` : ''}: ${e.title}`),
        ...todos.map((t) => `• Todo: ${t.title}${t.due_date ? ` (${t.due_date})` : ''}`),
      ]
      return `Geplande dingen:\n${lines.join('\n')}`
    }
    case 'help':
      return `Wat ik kan doen:

• "Zet in todo om factuur te sturen"
• "Toon open todos"
• "Verwijder mijn gehele todolijst"
• "Toon agenda deze week"
• "Maak contact Daan aan"
• "Maak project Website aan"
• "Toon mijn financien"
• "Heb gesport vandaag"`
    default:
      return `Hmm, dat begreep ik niet helemaal. Typ help voor een overzicht van commando's, of gebruik de modules aan de linkerkant.`
  }
}
