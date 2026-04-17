import { format } from 'date-fns'
import { query, queryOne } from '@/lib/db'
import { looseEntityMatch, normalizeDutch } from './normalize'
import { parseDate, parseDateTime, parseDurationMinutes, parseMoneyAmount, inferMomentLabel } from './time'
import type {
  ChatAction,
  ChatPlan,
  ChatQuery,
  ChatRuntimeContext,
  EventType,
  Priority,
  ProjectStatus,
  WorkContext,
} from './types'

export const SMALL_TALK_RESPONSES: Record<string, string> = {
  hey: 'Ik ben er. Zeg gewoon wat je wilt weten, loggen of plannen.',
  hoi: 'Ik ben er. Gooi het maar in normale taal.',
  hallo: 'Ik luister. Wat wil je doen?',
}

export function planMessage(message: string, context: ChatRuntimeContext): ChatPlan {
  const normalized = normalizeDutch(message)

  if (isConfirmation(normalized)) {
    return {
      kind: 'confirmation',
      confidence: 0.98,
      primaryIntent: 'confirmation_yes',
      actions: [],
    }
  }

  if (isCancellation(normalized)) {
    return {
      kind: 'confirmation',
      confidence: 0.98,
      primaryIntent: 'confirmation_no',
      actions: [],
    }
  }

  if (isSmallTalk(normalized)) {
    return {
      kind: 'small_talk',
      confidence: 0.95,
      primaryIntent: 'small_talk',
      actions: [],
    }
  }

  const correctionPlan = detectCorrectionPlan(normalized, context)
  if (correctionPlan) return correctionPlan

  const narrativePlan = detectNarrativePlan(message, normalized, context)
  if (narrativePlan) return narrativePlan

  const memoryPlan = detectMemoryPlan(normalized)
  if (memoryPlan) return memoryPlan

  const readPlan = detectReadPlan(normalized)
  if (readPlan) return readPlan

  const todoPlan = detectTodoPlan(message, normalized, context)
  if (todoPlan) return todoPlan

  const worklogPlan = detectWorklogPlan(message, normalized, context)
  if (worklogPlan) return worklogPlan

  const eventPlan = detectEventPlan(message, normalized, context)
  if (eventPlan) return eventPlan

  const habitPlan = detectHabitPlan(message, normalized)
  if (habitPlan) return habitPlan

  const financePlan = detectFinancePlan(message, normalized)
  if (financePlan) return financePlan

  const projectPlan = detectProjectPlan(message, normalized, context)
  if (projectPlan) return projectPlan

  const contactPlan = detectContactPlan(message, normalized)
  if (contactPlan) return contactPlan

  const memoryStorePlan = detectMemoryStorePlan(message, normalized)
  if (memoryStorePlan) return memoryStorePlan

  return {
    kind: 'unknown',
    confidence: 0.1,
    primaryIntent: 'unknown',
    actions: [],
  }
}

function isConfirmation(normalized: string): boolean {
  return /^(ja|ja hoor|ja doe maar|ja graag|doe maar|bevestig|yes|ok|oke)\b/.test(normalized)
}

function isCancellation(normalized: string): boolean {
  return /^(nee|nee hoor|toch niet|laat maar|annuleer|cancel)\b/.test(normalized)
}

function isSmallTalk(normalized: string): boolean {
  return /^(hey|hoi|hallo|goedemorgen|goedemiddag|goedenavond)\b/.test(normalized)
}

function detectMemoryPlan(normalized: string): ChatPlan | null {
  if (/\b(wie ben ik|wat weet je (nog )?over mij|wat weet je nog meer|wat weet je over mijn bedrijven|wat weet je over webs?up|wat doe ik bij bouma|welke projecten lopen er nu)\b/.test(normalized)) {
    let topic: string | undefined
    if (normalized.includes('websup')) topic = 'WebsUp'
    else if (normalized.includes('bouma')) topic = 'Bouma'
    else if (normalized.includes('bedrijven')) topic = 'bedrijven'
    else if (normalized.includes('projecten')) topic = 'projecten'

    return {
      kind: 'question',
      confidence: 0.95,
      primaryIntent: 'memory_profile',
      actions: [],
      query: { type: 'memory_profile', topic },
    }
  }
  return null
}

function detectReadPlan(normalized: string): ChatPlan | null {
  if (/\b(wat staat( er)? nog open|toon open todos|toon mijn todos|open taken|mijn taken|wat moet ik nog)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.95,
      primaryIntent: 'todo_list',
      actions: [],
      query: { type: 'todo_list', filter: normalized.includes('vandaag') ? 'today' : normalized.includes('week') ? 'week' : 'open' },
    }
  }

  if (/\b(toon .*agenda|agenda deze week|agenda vandaag|toon mijn agenda|wat staat er in mijn agenda)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.94,
      primaryIntent: 'agenda_list',
      actions: [],
      query: {
        type: 'agenda_list',
        filter: normalized.includes('morgen') ? 'tomorrow' : normalized.includes('vandaag') ? 'today' : 'week',
      },
    }
  }

  if (/\b(hoeveel gewerkt vandaag|werklog overzicht|toon werklog|toon werklogs|werkuren vandaag|hoeveel heb ik vandaag gewerkt)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.94,
      primaryIntent: 'worklog_summary',
      actions: [],
      query: { type: 'worklog_summary', period: normalized.includes('week') ? 'week' : 'today' },
    }
  }

  if (/\b(toon mijn financien|toon mijn financiën|wat heb ik deze week uitgegeven|hoeveel heb ik deze week uitgegeven|hoeveel heb ik vandaag uitgegeven|toon mijn uitgaven|toon mijn financien)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.94,
      primaryIntent: 'finance_summary',
      actions: [],
      query: {
        type: 'finance_summary',
        period: normalized.includes('week') ? 'week' : normalized.includes('vandaag') ? 'today' : 'month',
      },
    }
  }

  if (/\b(welke projecten lopen er nu|toon projecten|toon mijn projecten|projecten waar ik nog op wacht)\b/.test(normalized)) {
    return {
      kind: 'question',
      confidence: 0.92,
      primaryIntent: 'project_list',
      actions: [],
      query: { type: 'project_list', filter: normalized.includes('wacht') ? 'active' : 'all' },
    }
  }

  if (/\b(bij wie hoort|wie is .* ook alweer|toon contact van)\b/.test(normalized)) {
    const queryText = normalized
      .replace(/\b(bij wie hoort|wie is|ook alweer|toon contact van)\b/g, '')
      .trim()
    return {
      kind: 'question',
      confidence: 0.88,
      primaryIntent: 'contact_lookup',
      actions: [],
      query: { type: 'contact_lookup', query: queryText },
    }
  }

  return null
}

function detectTodoPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (/\b(maak dit belangrijk|maak die belangrijk|zet dit op belangrijk)\b/.test(normalized)) {
    const todo = resolveLastTodo(context)
    if (!todo || !todo.id) {
      return {
        kind: 'correction',
        confidence: 0.72,
        primaryIntent: 'todo_update_priority',
        actions: [],
        clarification: 'Ik weet niet welke taak je bedoelt. Noem even de taaknaam, dan zet ik hem op belangrijk.',
      }
    }
    return {
      kind: 'correction',
      confidence: 0.9,
      primaryIntent: 'todo_update_priority',
      actions: [{ type: 'todo_update', payload: { id: todo.id, priority: 'hoog' } }],
    }
  }

  if (/\b(verwijder alle data)\b/.test(normalized)) {
    return {
      kind: 'command',
      confidence: 0.95,
      primaryIntent: 'dangerous_delete_all_data',
      actions: [],
      clarification: 'Die actie is te destructief om zomaar vanuit de chat uit te voeren. Doe dit liever via een expliciete beheerflow.',
    }
  }

  if (/\b(verwijder alles|wis alles|gooi alles weg)\b/.test(normalized) && /\b(todo|taak|taken)\b/.test(normalized)) {
    return {
      kind: 'command',
      confidence: 0.96,
      primaryIntent: 'todo_delete_all',
      actions: [{ type: 'todo_delete_many', payload: { ids: context.openTodos.map((todo) => todo.id) } }],
      requiresConfirmation: true,
      confirmationPreview: `Ik ga ${context.openTodos.length} open taken verwijderen.`,
    }
  }

  if (/\b(verwijder|wis|gooi weg|haal weg)\b/.test(normalized) && /\b(todo|taak|die van)\b/.test(normalized)) {
    const queryText = extractSubjectAfterDelete(message, normalized)
    const matches = context.openTodos.filter((todo) => looseEntityMatch(queryText, todo.title) || normalizeDutch(todo.title).includes(normalizeDutch(queryText)))
    if (matches.length === 0) {
      return {
        kind: 'command',
        confidence: 0.7,
        primaryIntent: 'todo_delete',
        actions: [],
        clarification: `Ik vond geen open taak die past bij "${queryText}".`,
      }
    }
    if (matches.length > 1) {
      return {
        kind: 'command',
        confidence: 0.76,
        primaryIntent: 'todo_delete',
        actions: [],
        clarification: `Ik vond meerdere taken voor "${queryText}". Zeg even welke je bedoelt.`,
      }
    }
    return {
      kind: 'command',
      confidence: 0.9,
      primaryIntent: 'todo_delete',
      actions: [{ type: 'todo_delete', payload: { id: matches[0].id } }],
      requiresConfirmation: true,
      confirmationPreview: `Ik ga taak "${matches[0].title}" verwijderen.`,
    }
  }

  if (/\b(zet in todo|zet op todo|todo\b|taak\b|herinner me)\b/.test(normalized)) {
    const title = cleanTodoTitle(message)
    if (!title) return null
    const dueDate = parseDate(normalized, context.now)
    return {
      kind: 'command',
      confidence: 0.92,
      primaryIntent: 'todo_create',
      actions: [{
        type: 'todo_create',
        payload: {
          title,
          due_date: dueDate,
          priority: inferPriority(normalized),
          category: inferCategory(normalized),
        },
      }],
    }
  }

  return null
}

function detectEventPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (/\b(verplaats|verschuif)\b/.test(normalized) && /\b(afspraak|meeting|agenda|event|die afspraak)\b/.test(normalized)) {
    const event = resolveLastEvent(context)
    if (!event || !event.id) {
      return {
        kind: 'command',
        confidence: 0.74,
        primaryIntent: 'event_move',
        actions: [],
        clarification: 'Ik weet niet welke afspraak je wilt verplaatsen. Noem de afspraak even, dan pak ik hem.',
      }
    }
    const parsed = parseDateTime(normalized, context.now)
    if (!parsed.date) {
      return {
        kind: 'command',
        confidence: 0.72,
        primaryIntent: 'event_move',
        actions: [],
        clarification: 'Ik snap nog niet naar welke datum of tijd ik de afspraak moet verplaatsen.',
      }
    }
    return {
      kind: 'command',
      confidence: 0.9,
      primaryIntent: 'event_move',
      actions: [{
        type: 'event_update',
        payload: {
          id: event.id,
          date: parsed.date,
          time: parsed.time ?? null,
        },
      }],
    }
  }

  const looksLikeEvent = /agenda|meeting|afspraak|vergadering|call|deadline|herinner/.test(normalized)
  if (!looksLikeEvent) return null

  const parsedDateTime = parseDateTime(normalized, context.now)
  const title = cleanEventTitle(message)
  const type = inferEventType(normalized)

  if (!title) return null

  const hasExplicitScheduleVerb = /\b(zet|plan|maak|agendeer|verplaats)\b/.test(normalized) || normalized.includes('herinner me')
  const hasTemporalSignal = Boolean(parsedDateTime.date || parsedDateTime.time || inferMomentLabel(normalized))

  if (!hasExplicitScheduleVerb && hasTemporalSignal) {
    const preview = `Ik kan "${title}" in je agenda zetten${parsedDateTime.date ? ` op ${parsedDateTime.date}` : ''}${parsedDateTime.time ? ` om ${parsedDateTime.time}` : parsedDateTime.momentLabel ? ` (${parsedDateTime.momentLabel})` : ''}.`
    return {
      kind: 'informative_update',
      confidence: 0.86,
      primaryIntent: 'event_confirm',
      actions: [{
        type: 'event_create',
        payload: {
          title,
          date: parsedDateTime.date ?? format(context.now, 'yyyy-MM-dd'),
          time: parsedDateTime.time ?? null,
          type,
          moment_label: parsedDateTime.momentLabel,
        },
      }],
      requiresConfirmation: true,
      confirmationPreview: preview,
    }
  }

  if (hasExplicitScheduleVerb) {
    return {
      kind: 'command',
      confidence: 0.92,
      primaryIntent: 'event_create',
      actions: [{
        type: 'event_create',
        payload: {
          title,
          date: parsedDateTime.date ?? format(context.now, 'yyyy-MM-dd'),
          time: parsedDateTime.time ?? null,
          type,
          moment_label: parsedDateTime.momentLabel,
        },
      }],
    }
  }

  return null
}

function detectNarrativePlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  const narrativeKeywords = ['daarna', 'nadat ik wakker werd', 'uit bed gegaan', 'fortnite', 'vrije dag van bouma', 'verder gegaan met deze app']
  const looksNarrative = narrativeKeywords.some(k => normalized.includes(k))
  if (!looksNarrative) return null

  const actions: ChatAction[] = []
  const primaryDate = parseDate(normalized, context.now) ?? format(context.now, 'yyyy-MM-dd')
  const wakeTime = extractWakeTime(normalized)

  if (wakeTime) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Dagstart',
        summary: `Opgestaan om ${wakeTime}${primaryDate ? ` op ${primaryDate}` : ''}.`,
        category: 'day_start',
      },
    })
  }

  if (normalized.includes('vrij') && normalized.includes('bouma')) {
    actions.push({
      type: 'memory_store',
      payload: {
        key: 'Werkpatroon vrijdag',
        value: 'Vrijdag lijkt vaak je Bouma-vrije dag en een focusdag voor WebsUp.',
        category: 'work_pattern',
        confidence: 0.86,
      },
    })
  }

  if (normalized.includes('fortnite')) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Fortnite',
        summary: 'Los ontspanningsmoment na het opstaan.',
        category: 'recreation',
      },
    })
  }

  if (normalized.includes('deze app')) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Verder gewerkt aan deze app',
        summary: `Activiteit op ${primaryDate} binnen WebsUp-context.`,
        category: 'app_work',
      },
    })
  }

  if (actions.length === 0) return null

  const previewLines = [
    wakeTime ? `- dagstart loggen (${wakeTime})` : null,
    normalized.includes('vrij') && normalized.includes('bouma') ? '- vrijdag-context onthouden als Bouma-vrij / WebsUp-focus' : null,
    normalized.includes('fortnite') ? '- Fortnite als losse ontspanningsactiviteit op timeline zetten' : null,
    normalized.includes('deze app') ? '- activiteit aan deze app op timeline zetten' : null,
  ].filter(Boolean)

  return {
    kind: 'mixed_intent',
    confidence: 0.87,
    primaryIntent: 'rich_narrative',
    actions,
    requiresConfirmation: true,
    confirmationPreview: `Ik zie hier meerdere mogelijke assistentacties:\n${previewLines.join('\n')}`,
  }
}

function detectWorklogPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  const duration = parseDurationMinutes(normalized)
  const workKeywords = ['werklog', 'werk registratie', 'werkregistratie', 'gewerkt', 'meeting gehad', 'gebeld', 'bezig']
  const hasWorkSignal = workKeywords.some(k => normalized.includes(k)) || (!!duration && /\b(aan|voor|bij|op|gewerkt|gebeld|meeting|project|website|app|websup|bouma)\b/.test(normalized))
  if (!hasWorkSignal) return null

  const project = findBestProject(message, context)
  const contact = findBestContact(message, context)

  if (!duration && (project || contact || /\b(website|opleveren|app|klant)\b/.test(normalized))) {
    const dateHint = parseDate(normalized, context.now) ?? inferMomentLabel(normalized) ?? 'de juiste datum'
    const subject = project?.title ?? contact?.name ?? 'dit werkmoment'
    return {
      kind: 'mixed_intent',
      confidence: 0.82,
      primaryIntent: 'worklog_missing_duration',
      actions: [],
      clarification: `Ik haal hier een werkmoment uit rond ${subject} op ${dateHint}, maar ik mis nog de duur. Als je wilt kan ik dit als werklog opslaan zodra je zegt hoe lang het duurde.`,
    }
  }

  if (!duration) return null

  const title = buildWorklogTitle(message, project?.title, contact?.name)
  const suggestion = /\b(opleveren|oplevering)\b/.test(normalized)
    ? 'Morgen opleveren klinkt als een deadline. Als je wilt zet ik daar ook direct een agenda-item of todo van.'
    : undefined

  return {
    kind: /\b(en|maar)\b/.test(normalized) && suggestion ? 'mixed_intent' : 'log_entry',
    confidence: 0.93,
    primaryIntent: 'worklog_create',
    actions: [{
      type: 'worklog_create',
      payload: {
        title,
        duration_minutes: duration,
        context: inferWorkContext(normalized, project?.title),
        date: parseDate(normalized, context.now) ?? format(context.now, 'yyyy-MM-dd'),
        project_id: project?.id ?? null,
        contact_id: contact?.id ?? null,
        work_type: inferWorkType(normalized),
      },
    }],
    suggestion,
  }
}

function detectHabitPlan(message: string, normalized: string): ChatPlan | null {
  const habitName = inferHabitName(normalized)
  if (!habitName) return null
  return {
    kind: 'status_update',
    confidence: 0.9,
    primaryIntent: 'habit_log',
    actions: [{
      type: 'habit_log',
      payload: {
        habit_name: habitName,
        note: message,
        auto_create: true,
      },
    }],
  }
}

function detectFinancePlan(message: string, normalized: string): ChatPlan | null {
  const amount = parseMoneyAmount(message)
  if (!amount) return null

  if (/\b(factuur|factureren|factuur als nog te versturen)\b/.test(normalized)) {
    return {
      kind: 'command',
      confidence: 0.88,
      primaryIntent: 'finance_invoice',
      actions: [{
        type: 'finance_create_invoice',
        payload: {
          title: message.replace(/log deze factuur als /i, '').replace(/factuur/ig, '').trim() || 'Factuur',
          amount,
          due_date: parseDate(normalized),
          status: 'concept',
        },
      }],
    }
  }

  if (/\b(uitgegeven|uitgave|betaald|besteed|gekost)\b/.test(normalized)) {
    const title = extractFinanceTitle(message)
    return {
      kind: 'log_entry',
      confidence: 0.9,
      primaryIntent: 'finance_expense',
      actions: [{
        type: 'finance_create_expense',
        payload: {
          title,
          amount,
          category: inferCategory(normalized),
          description: message,
        },
      }],
    }
  }

  return null
}

function detectProjectPlan(message: string, normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (/\b(maak project|nieuw project|project .* aanmaken?)\b/.test(normalized)) {
    const title = message.replace(/maak project|nieuw project|aan/ig, '').trim()
    if (!title) return null
    return {
      kind: 'command',
      confidence: 0.88,
      primaryIntent: 'project_create',
      actions: [{ type: 'project_create', payload: { title } }],
    }
  }

  const project = findBestProject(message, context)
  if (project && /\b(opleveren|afgerond|klaar)\b/.test(normalized)) {
    return {
      kind: 'status_update',
      confidence: 0.84,
      primaryIntent: 'project_update',
      actions: [{ type: 'project_update', payload: { id: project.id, status: 'afgerond' } }],
    }
  }

  return null
}

function detectContactPlan(message: string, normalized: string): ChatPlan | null {
  if (!/\b(contact|persoon)\b/.test(normalized) || !/\b(maak|voeg)\b/.test(normalized)) return null

  const companyMatch = message.match(/\bvan\s+(.+)$/i)
  const rawName = message
    .replace(/maak|voeg|contact|aan|als/ig, ' ')
    .replace(/\bvan\s+.+$/i, ' ')
    .trim()
  const name = rawName.replace(/\s+/g, ' ').trim()
  if (!name) return null

  return {
    kind: 'command',
    confidence: 0.82,
    primaryIntent: 'contact_create',
    actions: [{
      type: 'contact_create',
      payload: {
        name,
        company: companyMatch?.[1]?.trim(),
      },
    }],
  }
}

function detectMemoryStorePlan(message: string, normalized: string): ChatPlan | null {
  if (!/\b(onthoud|sla op dat|weet dat)\b/.test(normalized)) return null
  const cleaned = message.replace(/onthoud|sla op dat|weet dat/ig, '').trim()
  if (!cleaned) return null
  return {
    kind: 'status_update',
    confidence: 0.84,
    primaryIntent: 'memory_store',
    actions: [{
      type: 'memory_store',
      payload: {
        key: cleaned.slice(0, 60),
        value: cleaned,
        category: 'personal_context',
        confidence: 0.9,
      },
    }],
  }
}

function detectCorrectionPlan(normalized: string, context: ChatRuntimeContext): ChatPlan | null {
  if (!/\b(in plaats van|eigenlijk)\b/.test(normalized)) return null
  const duration = parseDurationMinutes(normalized)
  if (!duration) return null
  if (context.recentWorklogs.length === 0) return null
  return {
    kind: 'correction',
    confidence: 0.88,
    primaryIntent: 'worklog_correct_last',
    actions: [{ type: 'worklog_update_last', payload: { duration_minutes: duration } }],
  }
}

function findBestProject(message: string, context: ChatRuntimeContext) {
  return context.activeProjects.find((project) => looseEntityMatch(message, project.title))
}

function findBestContact(message: string, context: ChatRuntimeContext) {
  return context.contacts.find((contact) =>
    looseEntityMatch(message, contact.name) ||
    (contact.company ? looseEntityMatch(message, contact.company) : false)
  )
}

function resolveLastTodo(context: ChatRuntimeContext) {
  for (const message of [...context.recentMessages].reverse()) {
    for (const action of message.actions) {
      if (action.type === 'todo_created') {
        return { id: action.data.id ?? 0, title: action.data.title }
      }
      if (action.type === 'todo_listed' && action.data.length > 0) {
        return { id: action.data[0].id, title: action.data[0].title }
      }
    }
  }
  return context.openTodos[0]
}

function resolveLastEvent(context: ChatRuntimeContext) {
  for (const message of [...context.recentMessages].reverse()) {
    for (const action of message.actions) {
      if (action.type === 'event_created') {
        return { id: action.data.id ?? 0, title: action.data.title }
      }
      if (action.type === 'events_listed' && action.data.length > 0) {
        return { id: action.data[0].id, title: action.data[0].title }
      }
    }
  }
  return context.upcomingEvents[0]
}

function cleanTodoTitle(message: string): string {
  return message
    .replace(/zet in todo dat ik/ig, '')
    .replace(/zet in todo/ig, '')
    .replace(/zet op todo/ig, '')
    .replace(/^todo\b[: ]*/i, '')
    .replace(/\bmaak dit belangrijk\b/ig, '')
    .replace(/herinner me(?: vanavond| morgen| straks)? aan/ig, '')
    .replace(/\btaak\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanEventTitle(message: string): string {
  return message
    .replace(/zet .*? agenda/ig, '')
    .replace(/zet in de agenda/ig, '')
    .replace(/zet in agenda/ig, '')
    .replace(/plan/ig, '')
    .replace(/\b(agenda|afspraak|vergadering|deadline|herinnering)\b/ig, '')
    .replace(/\b(vandaag|morgen|overmorgen|vanavond|vanmiddag|vanochtend|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\b/ig, '')
    .replace(/\bom\s+\d{1,2}(?::\d{2})?(?:\s*uur)?\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildWorklogTitle(message: string, projectTitle?: string, contactName?: string): string {
  const normalized = normalizeDutch(message)
  if (/\b(meeting|gebeld|call)\b/.test(normalized)) {
    if (contactName && projectTitle) return `Meeting met ${contactName} over ${projectTitle}`
    if (contactName) return `Meeting met ${contactName}`
  }
  if (projectTitle) return `Werk aan ${projectTitle}`
  return message
    .replace(/\b(ik heb|ik was|voeg toe aan werk registratie dat ik|voeg toe aan werk uren)\b/ig, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(uur|uren|u|h|min|minuten|minuut)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferEventType(normalized: string): EventType {
  if (/\b(deadline|opleveren|oplevering)\b/.test(normalized)) return 'deadline'
  if (/\b(afspraak)\b/.test(normalized)) return 'afspraak'
  if (/\b(herinner)\b/.test(normalized)) return 'herinnering'
  if (/\b(meeting|vergadering|call)\b/.test(normalized)) return 'vergadering'
  return 'algemeen'
}

function inferPriority(normalized: string): Priority {
  if (/\b(belangrijk|urgent|dringend|asap|zsm)\b/.test(normalized)) return 'hoog'
  if (/\b(later|laag|ooit)\b/.test(normalized)) return 'laag'
  return 'medium'
}

function inferCategory(normalized: string): string {
  if (/\b(factuur|betaling|financien|financiën|hosting|geld)\b/.test(normalized)) return 'financieel'
  if (/\b(werk|project|meeting|klant|bouma|websup)\b/.test(normalized)) return 'werk'
  if (/\b(sport|slaap|roken|eten)\b/.test(normalized)) return 'gezondheid'
  return 'overig'
}

function inferWorkContext(normalized: string, projectTitle?: string): WorkContext {
  if (/\b(bouma|installatie|elektra)\b/.test(normalized)) return 'Bouma'
  if (/\b(websup|camperhulp|prime animalz|website|hosting)\b/.test(normalized) || projectTitle) return 'WebsUp'
  if (/\b(studie|cursus|leren)\b/.test(normalized)) return 'studie'
  if (/\b(sport|prive|thuis)\b/.test(normalized)) return 'privé'
  return 'overig'
}

function inferWorkType(normalized: string): string {
  if (/\b(meeting|gebeld|call|gesproken)\b/.test(normalized)) return 'meeting'
  if (/\b(factuur|mail|offerte|administratie)\b/.test(normalized)) return 'admin'
  if (/\b(klussen|installeren|monteren)\b/.test(normalized)) return 'physical'
  return 'deep_work'
}

function inferHabitName(normalized: string): string | undefined {
  if (/\b(gesport|sporten|wezen sporten)\b/.test(normalized)) return 'Sporten'
  if (/\b(niet gerookt|niet roken)\b/.test(normalized)) return 'Niet roken'
  if (/\b(slecht geslapen|goed geslapen|geslapen)\b/.test(normalized)) return 'Slaap'
  if (/\b(moe vandaag|ik voel me moe)\b/.test(normalized)) return 'Energie'
  return undefined
}

function extractFinanceTitle(message: string): string {
  const after = message.match(/(?:aan|voor|bij|op)\s+(.+)$/i)
  const title = after?.[1] ?? message
  return title.replace(/\s+/g, ' ').trim()
}

function extractWakeTime(normalized: string): string | undefined {
  const halfMatch = normalized.match(/\bhalf\s+(\d{1,2})\b/)
  if (halfMatch) {
    const hour = (Number(halfMatch[1]) + 23) % 24
    return `${String(hour).padStart(2, '0')}:30`
  }

  const explicit = normalized.match(/\bom\s+(\d{1,2})(?::(\d{2}))?(?:\s*uur)?\b/)
  if (!explicit) return undefined
  const hour = Number(explicit[1])
  const minute = explicit[2] ? Number(explicit[2]) : 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function extractSubjectAfterDelete(message: string, normalized: string): string {
  const explicit = message.match(/(?:verwijder|wis|gooi weg|haal weg)\s+(?:alleen\s+)?(?:die van\s+)?(.+)$/i)
  if (explicit?.[1]) return explicit[1].replace(/\s+/g, ' ').trim()
  return normalized.replace(/verwijder|wis|gooi weg|haal weg|todo|taak|taken/ig, '').replace(/\s+/g, ' ').trim()
}
