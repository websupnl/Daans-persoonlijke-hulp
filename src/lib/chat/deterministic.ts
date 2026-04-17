import { looseEntityMatch, normalizeDutch } from './normalize'
import type {
  ChatPlan,
  ChatRuntimeContext,
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

  // 3. Very specific commands that we want to be instant and 100% reliable
  // But actually, even these can be handled by AI if we want natural language.
  // I will keep only the most basic ones.

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
