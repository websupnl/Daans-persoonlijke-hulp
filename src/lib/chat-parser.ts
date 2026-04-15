/**
 * Rule-based Dutch/English NLP parser voor chat commands.
 * Herkent intenties en extraheert entiteiten zonder AI API.
 */

import { format, addDays, addWeeks, nextFriday, nextMonday, parseISO, isValid } from 'date-fns'
import { nl } from 'date-fns/locale'

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
  | 'journal_open'
  | 'memory_add'
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
    // DD-MM of DD/MM of DD-MM-YYYY
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

  // ── Uitgave loggen — breed patroon: "10 euro aan ontbijt", "€5 koffie", etc. ──
  if (/\b(uitgave|uitge[a-z]+|betaald|kosten|expense|heb betaald|besteed|gespendeerd|gekost)\b/i.test(text)
    || /\b(zonet|net|vandaag|gisteren)\b.{0,30}\b(euro|eur|€|\d+)\b/i.test(text)
    || /\b(euro|eur|€|\d+)\b.{0,30}\b(aan|voor|bij|op)\b/i.test(text)) {
    const amount = extractAmount(text)
    const descMatch = text.match(/(?:voor|aan|bij|op)\s+(.{3,40})$/i) || text.match(/\d+\s*(?:euro|eur|€)?\s+(.{3,40})$/i)
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

  // ── Inkomst loggen ──
  if (/\b(ontvangen|inkomst|betaling ontvangen|income|received|kreeg betaald)\b/i.test(text)) {
    const amount = extractAmount(text)
    return {
      intent: 'finance_add_income',
      confidence: 0.85,
      params: {
        title: text.slice(0, 60),
        amount,
      },
      raw: text,
    }
  }

  // ── Financiën overzicht ──
  if (/\b(financieel overzicht|mijn financiën|open facturen|openstaand|toon facturen|show invoices)\b/i.test(text)) {
    return { intent: 'finance_list', confidence: 0.88, params: {}, raw: text }
  }

  // ── Gewoonte loggen ──
  if (/\b(heb gesport|heb gelopen|heb gefietst|heb gezwommen|heb geoefend|log gewoonte|gewoonte gedaan|heb geslapen|goed geslapen)\b/i.test(text)) {
    const habitMatch = text.match(/\b(gesport|gelopen|gefietst|gezwommen|geoefend|geslapen|gemediteerd|gelezen)\b/i)
    return {
      intent: 'habit_log',
      confidence: 0.85,
      params: { habit_name: habitMatch?.[1] },
      raw: text,
    }
  }

  // ── Gewoontes overzicht ──
  if (/\b(gewoontes?|habits?|toon gewoontes?|mijn gewoontes?|streak)\b/i.test(text)) {
    return { intent: 'habit_list', confidence: 0.85, params: {}, raw: text }
  }

  // ── Dagboek ──
  if (/\b(dagboek|journal|dagelijkse log|schrijf in dagboek|open dagboek)\b/i.test(text)) {
    return { intent: 'journal_open', confidence: 0.88, params: {}, raw: text }
  }

  // ── Statistieken / dashboard ──
  if (/\b(statistieken|stats|dashboard|overzicht|samenvatting|summary|hoe gaat het)\b/i.test(text)) {
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

  // ── Werklog toevoegen ──
  if (/\b(gewerkt aan|heb gewerkt|werklog|uren gelogd?|gelogd|time log|tijdlog|heb.{0,20}uur.{0,20}gewerkt|heb.{0,20}min.{0,20}gewerkt)\b/i.test(text)
    || /\b\d+[.,]?\d*\s*(uur|u|h|uren|min|minuten|minuut)\b.{0,30}\b(aan|bij|voor|op|gewerkt|gesleuteld|gebouwd|geschreven|gecoded|gemaild|gebeld)\b/i.test(text)) {
    const durationMatch = text.match(/(\d+)[.,]?(\d*)\s*(uur|u|h|uren)/) || text.match(/(\d+)\s*(min|minuten|minuut)/)
    let duration: number | undefined
    if (durationMatch) {
      if (/uur|u|h|uren/.test(durationMatch[3] ?? '')) {
        duration = parseInt(durationMatch[1]) * 60 + (durationMatch[2] ? parseInt(durationMatch[2]) * 6 : 0)
      } else {
        duration = parseInt(durationMatch[1])
      }
    }
    const contextMatch = text.match(/\b(bouma|websup|webdesign|privé|prive|studie)\b/i)
    const contextMap: Record<string, string> = { bouma: 'Bouma', websup: 'WebsUp', webdesign: 'WebsUp', privé: 'privé', prive: 'privé', studie: 'studie' }
    return {
      intent: 'worklog_add',
      confidence: 0.85,
      params: {
        title: text.slice(0, 80),
        duration_minutes: duration,
        context: contextMatch ? contextMap[contextMatch[1].toLowerCase()] : undefined,
      },
      raw: text,
    }
  }

  // ── Werklog lijst ──
  if (/\b(toon werklogs?|mijn werklogs?|hoeveel gewerkt|werkuren|vandaag gewerkt|werklog overzicht)\b/i.test(text)) {
    return { intent: 'worklog_list', confidence: 0.88, params: {}, raw: text }
  }

  // ── Event / agenda toevoegen ──
  if (/\b(agenda|event|afspraak|vergadering|meeting|deadline|herinnering|reminder|zet in agenda|plan.{0,15}in|afgesproken met|gepland)\b/i.test(text)) {
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2})\b/)
    const typeMap: Record<string, string> = {
      vergadering: 'vergadering', meeting: 'vergadering', call: 'vergadering',
      deadline: 'deadline', afspraak: 'afspraak', herinnering: 'herinnering', reminder: 'herinnering',
    }
    const typeMatch = text.match(/\b(vergadering|meeting|call|deadline|afspraak|herinnering|reminder)\b/i)
    return {
      intent: 'event_add',
      confidence: 0.85,
      params: {
        title: text.replace(/\b(agenda|event|zet in agenda|plan in|gepland|vergadering|meeting|afspraak|deadline|herinnering)\b/gi, '').trim().slice(0, 80) || text.slice(0, 80),
        date: extractDate(text) || new Date().toISOString().split('T')[0],
        time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : undefined,
        type: typeMatch ? (typeMap[typeMatch[1].toLowerCase()] || 'algemeen') : 'algemeen',
      },
      raw: text,
    }
  }

  // ── Event lijst / agenda bekijken ──
  if (/\b(toon agenda|mijn agenda|agenda vandaag|agenda deze week|komende events?|aankomende afspraken|wat staat er op de agenda)\b/i.test(text)) {
    return { intent: 'event_list', confidence: 0.88, params: {}, raw: text }
  }

  // ── Help ──
  if (/\b(help|wat kan je|what can you|commando's?|commands?|hoe gebruik|how to use)\b/i.test(text)) {
    return { intent: 'help', confidence: 0.95, params: {}, raw: text }
  }

  return { intent: 'unknown', confidence: 0, params: {}, raw: text }
}

// ─── Response generator ───────────────────────────────────────────────────────

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
      if (!contacts || contacts.length === 0) return 'Nog geen contacten. Typ "voeg contact toe [naam]" om te beginnen.'
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

    case 'habit_list':
      return `🎯 Je gewoontes zijn te zien in het Gewoontes-tabblad.`

    case 'journal_open':
      return `📖 Dagboek geopend voor vandaag.`

    case 'stats':
      return `📊 Hier is je overzicht:`

    case 'memory_add':
      return `🧠 Onthouden: "${params.fact}"`

    case 'worklog_add':
      if (actionResult) {
        const log = actionResult as { title: string; duration_minutes: number }
        const h = Math.floor((log.duration_minutes || 0) / 60)
        const m = (log.duration_minutes || 0) % 60
        return `⏱️ Werklog opgeslagen: **"${log.title}"** · ${h > 0 ? h + 'u ' : ''}${m > 0 ? m + 'm' : ''}`
      }
      return '⏱️ Werklog opgeslagen!'

    case 'worklog_list': {
      const result = actionResult as { total_minutes: number; count: number; entries: Array<{ title: string; duration_minutes: number; context: string }> } | undefined
      if (!result || result.count === 0) return '📊 Geen werklogs gevonden voor vandaag. Start een timer of gebruik AI-invoer in het Werklog scherm.'
      const h = Math.floor(result.total_minutes / 60)
      const m = result.total_minutes % 60
      const list = result.entries.slice(0, 5).map(e => {
        const eh = Math.floor((e.duration_minutes || 0) / 60)
        const em = (e.duration_minutes || 0) % 60
        return `• ${e.title} (${eh > 0 ? eh + 'u ' : ''}${em > 0 ? em + 'm' : ''}, ${e.context})`
      }).join('\n')
      return `⏱️ **Vandaag gewerkt: ${h}u ${m}m** (${result.count} logs)\n${list}`
    }

    case 'event_add':
      if (actionResult) {
        const ev = actionResult as { title: string; date: string; time?: string }
        return `📅 Event aangemaakt: **"${ev.title}"** op ${ev.date}${ev.time ? ` om ${ev.time}` : ''}`
      }
      return '📅 Event toegevoegd aan je agenda!'

    case 'event_list': {
      const evs = actionResult as Array<{ title: string; date: string; time?: string; type: string }> | undefined
      if (!evs || evs.length === 0) return '📅 Geen komende events. Zeg _"plan vergadering morgen om 14:00"_ om iets toe te voegen.'
      const list = evs.map(e => `• ${e.date}${e.time ? ` ${e.time}` : ''}: **${e.title}**`).join('\n')
      return `📅 **Komende events:**\n${list}`
    }

    case 'help':
      return `**Wat ik kan doen:**

📋 **Todos**
• _"Zet in todo om factuur te sturen naar MCE"_
• _"Markeer factuur als gedaan"_
• _"Toon open todos"_

📝 **Notes**
• _"Noteer: idee voor nieuw project"_

👤 **Contacten**
• _"Voeg contact toe Jan Jansen jan@example.com"_

💰 **Financiën**
• _"Factuur voor MCE hosting €150"_
• _"Uitgave €45 voor kantoorspullen"_

⏱️ **Werklog**
• _"Heb 2 uur gewerkt aan WebsUp"_
• _"Toon mijn werklogs vandaag"_

📅 **Agenda**
• _"Plan vergadering morgen om 10:00"_
• _"Deadline project vrijdag"_
• _"Toon agenda deze week"_

🎯 **Gewoontes**
• _"Heb gesport vandaag"_

📖 **Dagboek**
• _"Open dagboek"_

🧠 **Geheugen**
• _"Onthoud dat mijn uurtarief €95 is"_`

    default:
      return `Hmm, dat begreep ik niet helemaal. Typ **help** voor een overzicht van commando's, of gebruik de modules aan de linkerkant.`
  }
}
