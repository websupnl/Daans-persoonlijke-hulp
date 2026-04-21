import { looseEntityMatch, normalizeDutch } from './normalize'
import { parseDateTime } from './time'
import type {
  ChatAction,
  ChatPlan,
  ChatRuntimeContext,
  WorkContext,
} from './types'

export const SMALL_TALK_RESPONSES: Record<string, string> = {
  hey: 'Hoi! Ik ben er. Wat kan ik voor je doen?',
  hoi: 'Hoi! Hoe gaat het? Kan ik je ergens bij helpen?',
  hallo: 'Hallo! Ik luister. Heb je iets om te loggen of te plannen?',
  bedankt: 'Graag gedaan! Als er nog iets is, hoor ik het.',
  dankje: 'Geen probleem! Succes nog even.',
  dankjewel: 'Met plezier gedaan.',
}

export function planMessage(message: string, context: ChatRuntimeContext): ChatPlan {
  const normalized = normalizeDutch(message)

  // 1. Confirmations (Very specific)
  if (isConfirmation(normalized)) {
    return {
      kind: 'confirmation',
      confidence: 0.99,
      primaryIntent: 'confirmation_yes',
      actions: [],
    }
  }

  if (isCancellation(normalized)) {
    return {
      kind: 'confirmation',
      confidence: 0.99,
      primaryIntent: 'confirmation_no',
      actions: [],
    }
  }

  // 2. Small talk
  if (isSmallTalk(normalized)) {
    return {
      kind: 'small_talk',
      confidence: 0.95,
      primaryIntent: 'small_talk',
      actions: [],
    }
  }

  const pronounTodoPriority = extractPronounTodoPriority(normalized, context)
  if (pronounTodoPriority) {
    return {
      kind: 'correction',
      confidence: 0.86,
      primaryIntent: 'todo_update_priority',
      actions: [pronounTodoPriority],
    }
  }

  const eventCreate = extractEventCreate(message, normalized, context)
  if (eventCreate) {
    return {
      kind: 'command',
      confidence: 0.9,
      primaryIntent: 'event_create',
      actions: [eventCreate],
    }
  }

  const directWorklog = extractDirectWorklog(message, normalized, context)
  if (directWorklog) {
    return {
      kind: 'log_entry',
      confidence: 0.93,
      primaryIntent: 'worklog_create',
      actions: [directWorklog],
    }
  }

  const missingWorklogDuration = detectWorklogMissingDuration(normalized, context)
  if (missingWorklogDuration) {
    return {
      kind: 'log_entry',
      confidence: 0.74,
      primaryIntent: 'worklog_missing_duration',
      actions: [],
      clarification: 'Ik mis nog de duur. Hoe lang duurde dit ongeveer?',
    }
  }

  const habitLog = extractHabitLog(normalized, context)
  if (habitLog) {
    return {
      kind: 'log_entry',
      confidence: 0.86,
      primaryIntent: 'habit_log',
      actions: [habitLog],
    }
  }

  const richNarrative = extractRichNarrative(message, normalized, context)
  if (richNarrative.length >= 3) {
    return {
      kind: 'mixed_intent',
      confidence: 0.72,
      primaryIntent: 'rich_narrative',
      actions: richNarrative,
      requiresConfirmation: true,
      confirmationPreview: 'Ik herken meerdere losse gebeurtenissen. Wil je dat ik deze als timeline-items vastleg?',
    }
  }

  return {
    kind: 'unknown',
    confidence: 0.1,
    primaryIntent: 'unknown',
    actions: [],
  }
}

function extractPronounTodoPriority(normalized: string, context: ChatRuntimeContext): ChatAction | null {
  if (!/\b(maak|zet)\s+(dit|deze|hem|die)\s+(belangrijk|hoog|urgent|prioriteit)\b/.test(normalized)) return null

  const recentListedTodo = [...context.recentMessages]
    .reverse()
    .flatMap((message) => message.actions)
    .find((action) => action.type === 'todo_listed')

  const todo = recentListedTodo?.type === 'todo_listed'
    ? recentListedTodo.data[0]
    : context.openTodos[0]

  if (!todo?.id) return null

  return {
    type: 'todo_update',
    payload: {
      id: todo.id,
      priority: 'hoog',
    },
  }
}

function extractEventCreate(
  originalMessage: string,
  normalized: string,
  context: ChatRuntimeContext
): ChatAction | null {
  if (!/\b(agenda|plan|afspraak|meeting|vergadering|herinnering)\b/.test(normalized)) return null

  const dateTime = parseDateTime(originalMessage, context.now)
  if (!dateTime.date && !dateTime.time) return null

  const title = extractEventTitle(originalMessage)
  if (!title) return null

  const contact = context.contacts.find((item) =>
    normalized.includes(normalizeDutch(item.name)) ||
    (item.company ? normalized.includes(normalizeDutch(item.company)) : false)
  )

  const project = context.activeProjects.find((item) =>
    normalized.includes(normalizeDutch(item.title)) || looseEntityMatch(title, item.title)
  )

  return {
    type: 'event_create',
    payload: {
      title,
      date: dateTime.date ?? context.now.toISOString().split('T')[0],
      time: dateTime.time,
      type: inferEventType(normalized),
      duration: 60,
      contact_id: contact?.id,
      project_id: project?.id,
      moment_label: dateTime.momentLabel,
    },
  }
}

function extractEventTitle(originalMessage: string): string {
  const cleaned = originalMessage
    .replace(/^.*?\b(?:agenda|plan|zet)\b.*?\b(?:voor|op)\b\s+/i, '')
    .replace(/\b\d{1,2}\s+(?:jan(?:uari)?|feb(?:ruari)?|mrt|maart|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|aug(?:ustus)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+\d{4})?\b/i, '')
    .replace(/\bom\s+\d{1,2}(?::\d{2})?\s*(?:uur)?\b/i, '')
    .replace(/^[\s:,-]+/, '')
    .replace(/[.!,]+$/, '')
    .trim()

  if (!cleaned) return 'Agenda-item'
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function inferEventType(normalized: string): 'vergadering' | 'deadline' | 'afspraak' | 'herinnering' | 'algemeen' {
  if (/\b(meeting|vergadering|overleg)\b/.test(normalized)) return 'vergadering'
  if (/\bdeadline\b/.test(normalized)) return 'deadline'
  if (/\b(herinner|reminder)\b/.test(normalized)) return 'herinnering'
  if (/\b(afspraak|bel|bellen)\b/.test(normalized)) return 'afspraak'
  return 'algemeen'
}

function detectWorklogMissingDuration(normalized: string, context: ChatRuntimeContext): boolean {
  if (extractDurationMinutes(normalized)) return false

  const mentionsWorkActivity = /\b(gebeld|call|overleg|gewerkt|bezig|gemaakt|gebouwd|afgemaakt|opgeleverd)\b/.test(normalized)
  const mentionsKnownWorkContext =
    context.contacts.some((contact) => normalized.includes(normalizeDutch(contact.name))) ||
    context.activeProjects.some((project) => normalized.includes(normalizeDutch(project.title))) ||
    /\b(website|app|websup|bouma|klant)\b/.test(normalized)

  return mentionsWorkActivity && mentionsKnownWorkContext
}

function extractHabitLog(normalized: string, context: ChatRuntimeContext): ChatAction | null {
  if (!/\b(gedaan|geweest|afgevinkt|gelogd|voltooid)\b/.test(normalized)) return null

  const habit = context.habits.find((item) =>
    normalized.includes(normalizeDutch(item.name)) ||
    normalized.includes(normalizeDutch(item.name).replace(/en$/, '')) ||
    looseEntityMatch(normalized, item.name)
  )

  if (!habit) return null

  return {
    type: 'habit_log',
    payload: {
      habit_name: habit.name,
    },
  }
}

function extractRichNarrative(originalMessage: string, normalized: string, context: ChatRuntimeContext): ChatAction[] {
  const hasNarrativeFlow = /\b(daarn?a|nadat|verder gegaan|wakker|uit bed|potje)\b/.test(normalized)
  if (!hasNarrativeFlow) return []

  const actions: ChatAction[] = []
  const date = parseDateTime(originalMessage, context.now).date ?? context.now.toISOString().split('T')[0]

  if (/\bwakker|uit bed\b/.test(normalized)) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Opgestaan',
        summary: originalMessage,
        category: 'dagboek',
      },
    })
  }

  if (/\bfortnite|potje\b/.test(normalized)) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Ontspanning',
        summary: 'Potje Fortnite gespeeld.',
        category: 'persoonlijk',
      },
    })
  }

  if (/\b(app|website|websup|verder gegaan)\b/.test(normalized)) {
    actions.push({
      type: 'timeline_log',
      payload: {
        title: 'Verder gewerkt aan app',
        summary: `Werkmoment op ${date}.`,
        category: inferWorkContext(originalMessage, normalized),
      },
    })
  }

  return actions
}

function isConfirmation(normalized: string): boolean {
  // Only match if it's primarily a confirmation
  return /^(ja|ja hoor|ja doe maar|ja graag|doe maar|bevestig|yes|ok|oke|is goed|prima)\b/.test(normalized) && normalized.split(' ').length <= 3
}

function isCancellation(normalized: string): boolean {
  return /^(nee|nee hoor|toch niet|laat maar|annuleer|cancel)\b/.test(normalized) && normalized.split(' ').length <= 3
}

function isSmallTalk(normalized: string): boolean {
  return /^(hey|hoi|hallo|goedemorgen|goedemiddag|goedenavond|bedankt|dankje|dankjewel)\b/.test(normalized) && normalized.split(' ').length <= 2
}

function extractDirectWorklog(
  originalMessage: string,
  normalized: string,
  context: ChatRuntimeContext
): ChatAction | null {
  const duration = extractDurationMinutes(normalized)
  if (!duration) return null

  const looksLikeWorklog =
    /\b(bezig geweest|bezig met|gewerkt aan|gewerkt voor|gebouwd aan|bezig aan|gewerkt)\b/.test(normalized) ||
    /\baan\b/.test(normalized)

  if (!looksLikeWorklog) return null

  const title = extractWorklogTitle(originalMessage, normalized)
  if (!title) return null

  const resolvedProject = context.activeProjects.find((project) =>
    looseEntityMatch(title, project.title) || normalized.includes(normalizeDutch(project.title))
  )

  const inferredContext = inferWorkContext(title, normalized, resolvedProject?.title)

  return {
    type: 'worklog_create',
    payload: {
      title,
      duration_minutes: duration,
      context: inferredContext,
      project_id: resolvedProject?.id,
    },
  }
}

function extractDurationMinutes(normalized: string): number | null {
  const hoursMatch = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(uur|uren|u)\b/)
  if (hoursMatch) {
    const hours = Number(hoursMatch[1].replace(',', '.'))
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60)
  }

  const minutesMatch = normalized.match(/\b(\d+)\s*(min|mins|minuten|minute)\b/)
  if (minutesMatch) {
    const minutes = Number(minutesMatch[1])
    if (Number.isFinite(minutes) && minutes > 0) return minutes
  }

  return null
}

function extractWorklogTitle(originalMessage: string, normalized: string): string | null {
  const match =
    originalMessage.match(/\b(?:bezig geweest aan|bezig geweest met|bezig aan|bezig met|gewerkt aan|gewerkt voor)\s+(.+)$/i) ||
    originalMessage.match(/\b(?:aan)\s+(.+)$/i)

  const rawTitle = match?.[1]?.trim()
  if (!rawTitle) return null

  const cleaned = rawTitle
    .replace(/^[\s:,-]+/, '')
    .replace(/[.!,]+$/, '')
    .trim()

  if (!cleaned) return null

  if (/^\d+\s*(uur|uren|u|min|minuten)\b/i.test(cleaned)) return null

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function inferWorkContext(title: string, normalized: string, projectTitle?: string): WorkContext {
  const combined = `${title} ${projectTitle ?? ''} ${normalized}`
  if (/\bbouma\b/.test(combined)) return 'Bouma'
  if (/\b(websup|daan?s persoonlijke hulp|persoonlijke hulp app|app)\b/i.test(combined)) return 'WebsUp'
  if (/\bstudie\b/.test(combined)) return 'studie'
  if (/\bprive\b/.test(normalized)) return 'privé'
  return 'WebsUp'
}
