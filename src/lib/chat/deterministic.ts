import { looseEntityMatch, normalizeDutch } from './normalize'
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

  const directWorklog = extractDirectWorklog(message, normalized, context)
  if (directWorklog) {
    return {
      kind: 'log_entry',
      confidence: 0.93,
      primaryIntent: 'worklog_create',
      actions: [directWorklog],
    }
  }

  return {
    kind: 'unknown',
    confidence: 0.1,
    primaryIntent: 'unknown',
    actions: [],
  }
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
