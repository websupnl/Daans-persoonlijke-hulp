import { addDays, addWeeks, format, isValid, parse, subDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import { normalizeDutch } from './normalize'

export interface ParsedDateTime {
  date?: string
  time?: string | null
  momentLabel?: string
}

const MONTH_PATTERN = /\b(\d{1,2})\s+(jan(?:uari)?|feb(?:ruari)?|mrt|maart|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|aug(?:ustus)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i
const WEEKDAY_ORDER = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

export function parseDateTime(text: string, now: Date = new Date()): ParsedDateTime {
  const normalized = normalizeDutch(text)
  const explicitDate = parseDate(normalized, now)
  const parsedTime = parseTime(normalized)
  const momentLabel = inferMomentLabel(normalized)

  return {
    date: explicitDate,
    time: parsedTime.explicit ? parsedTime.time : null,
    momentLabel: parsedTime.explicit ? undefined : momentLabel,
  }
}

export function parseDate(text: string, now: Date = new Date()): string | undefined {
  const normalized = normalizeDutch(text)

  const exactIso = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (exactIso) {
    const parsed = new Date(Number(exactIso[1]), Number(exactIso[2]) - 1, Number(exactIso[3]))
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd')
  }

  const exactNumeric = normalized.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/)
  if (exactNumeric) {
    const year = exactNumeric[3]
      ? exactNumeric[3].length === 2
        ? 2000 + Number(exactNumeric[3])
        : Number(exactNumeric[3])
      : now.getFullYear()
    const parsed = new Date(year, Number(exactNumeric[2]) - 1, Number(exactNumeric[1]))
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd')
  }

  const monthDate = normalized.match(MONTH_PATTERN)
  if (monthDate) {
    const year = monthDate[3] ? Number(monthDate[3]) : inferYearForMonthDay(Number(monthDate[1]), monthDate[2], now)
    const parsed = parse(`${monthDate[1]} ${monthDate[2]} ${year}`, 'd MMMM yyyy', now, { locale: nl })
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd')
  }

  if (/\b(vandaag)\b/.test(normalized)) return format(now, 'yyyy-MM-dd')
  if (/\b(gisteren|gister)\b/.test(normalized)) return format(subDays(now, 1), 'yyyy-MM-dd')
  if (/\b(eergisteren|eergister)\b/.test(normalized)) return format(subDays(now, 2), 'yyyy-MM-dd')
  if (/\b(morgen)\b/.test(normalized)) return format(addDays(now, 1), 'yyyy-MM-dd')
  if (/\b(overmorgen)\b/.test(normalized)) return format(addDays(now, 2), 'yyyy-MM-dd')
  if (normalized.includes('volgende week')) return format(addWeeks(now, 1), 'yyyy-MM-dd')

  for (let index = 0; index < WEEKDAY_ORDER.length; index++) {
    const day = WEEKDAY_ORDER[index]
    if (!normalized.includes(day)) continue
    if (normalized.includes(`afgelopen ${day}`) || normalized.includes(`vorige ${day}`)) {
      return format(previousWeekday(now, index), 'yyyy-MM-dd')
    }
    return format(nextWeekday(now, index), 'yyyy-MM-dd')
  }

  return undefined
}

export function parseTime(text: string): { explicit: boolean; time?: string } {
  const normalized = normalizeDutch(text)

  const halfMatch = normalized.match(/\bhalf\s+(\d{1,2})\b/)
  if (halfMatch) {
    const hour = (Number(halfMatch[1]) + 23) % 24
    return {
      explicit: true,
      time: `${String(hour).padStart(2, '0')}:30`,
    }
  }

  const explicit = normalized.match(/\bom\s+(\d{1,2})(?::(\d{2}))?(?:\s*uur)?\b/) || normalized.match(/\b(\d{1,2}):(\d{2})\b/)
  if (explicit) {
    const hour = Number(explicit[1])
    const minute = explicit[2] ? Number(explicit[2]) : 0
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return {
        explicit: true,
        time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      }
    }
  }

  return { explicit: false }
}

export function inferMomentLabel(text: string): string | undefined {
  const normalized = normalizeDutch(text)
  if (normalized.includes('vanavond') || normalized.includes('van avond')) return 'vanavond'
  if (normalized.includes('vanochtend') || normalized.includes('van ochtend')) return 'vanochtend'
  if (normalized.includes('vanmiddag') || normalized.includes('van middag')) return 'vanmiddag'
  if (normalized.includes('morgenavond')) return 'morgenavond'
  if (normalized.includes('morgenochtend')) return 'morgenochtend'
  if (normalized.includes('morgenmiddag')) return 'morgenmiddag'
  if (/\b(straks|zo meteen|zometeen|later vandaag)\b/.test(normalized)) return 'straks'
  return undefined
}

export function parseDurationMinutes(text: string): number | undefined {
  const normalized = normalizeDutch(text)

  const range = normalized.match(/\bvan\s+(\d{1,2}):(\d{2})\s+tot\s+(\d{1,2}):(\d{2})\b/)
  if (range) {
    const start = Number(range[1]) * 60 + Number(range[2])
    const end = Number(range[3]) * 60 + Number(range[4])
    if (end > start) return end - start
  }

  if (/\bhalf uur\b/.test(normalized)) return 30
  if (/\bkwartier\b/.test(normalized)) return 15
  if (/\been uur\b/.test(normalized)) return 60

  const hoursMatch = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(uur|uren|u|h)\b/)
  if (hoursMatch) {
    return Math.round(Number(hoursMatch[1].replace(',', '.')) * 60)
  }

  const minutesMatch = normalized.match(/\b(\d+)\s*(min|mins|minuut|minuten|m)\b/)
  if (minutesMatch) {
    return Number(minutesMatch[1])
  }

  return undefined
}

export function parseMoneyAmount(text: string): number | undefined {
  const normalized = normalizeDutch(text)
  const currencyMatch = normalized.match(/(?:€|\beuro\b|\beur\b)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|\beuro\b|\beur\b)/i)
  if (currencyMatch) {
    const raw = currencyMatch[1] ?? currencyMatch[2]
    return Number(raw.replace(',', '.'))
  }

  if (/\b(uitgegeven|uitgave|betaald|gekost|besteed)\b/.test(normalized)) {
    const amount = normalized.match(/\b(\d+(?:[.,]\d{1,2})?)\b/)
    if (amount) return Number(amount[1].replace(',', '.'))
  }

  return undefined
}

function inferYearForMonthDay(day: number, monthName: string, now: Date): number {
  const currentYear = now.getFullYear()
  const parsed = parse(`${day} ${monthName} ${currentYear}`, 'd MMMM yyyy', now, { locale: nl })
  if (!isValid(parsed)) return currentYear
  if (parsed < startOfToday(now)) return currentYear + 1
  return currentYear
}

function nextWeekday(now: Date, targetDay: number): Date {
  const result = new Date(now)
  result.setHours(0, 0, 0, 0)
  const diff = (targetDay - result.getDay() + 7) % 7 || 7
  result.setDate(result.getDate() + diff)
  return result
}

function previousWeekday(now: Date, targetDay: number): Date {
  const result = new Date(now)
  result.setHours(0, 0, 0, 0)
  const diff = (result.getDay() - targetDay + 7) % 7 || 7
  result.setDate(result.getDate() - diff)
  return result
}

function startOfToday(now: Date): Date {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date
}
