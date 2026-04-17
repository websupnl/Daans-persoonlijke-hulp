import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | undefined | null): string {
  if (!date) return ''
  try {
    const d = parseISO(date)
    if (isToday(d)) return 'Vandaag'
    if (isTomorrow(d)) return 'Morgen'
    return format(d, 'd MMM', { locale: nl })
  } catch {
    return date
  }
}

export function formatDateFull(date: string | undefined | null): string {
  if (!date) return ''
  try {
    return format(parseISO(date), 'd MMMM yyyy', { locale: nl })
  } catch {
    return date
  }
}

export function formatRelative(date: string | undefined | null): string {
  if (!date) return ''
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true, locale: nl })
  } catch {
    return date
  }
}

export function isOverdue(date: string | undefined | null): boolean {
  if (!date) return false
  try {
    return isPast(parseISO(date)) && !isToday(parseISO(date))
  } catch {
    return false
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^• /gm, '&#8226; ')
    .replace(/\n/g, '<br/>')
}

export const PRIORITY_COLORS = {
  hoog: 'text-red-400 bg-red-950/50 border-red-900',
  medium: 'text-amber-400 bg-amber-950/50 border-amber-900',
  laag: 'text-emerald-400 bg-emerald-950/50 border-emerald-900',
}

export const PRIORITY_DOT = {
  hoog: 'bg-red-400',
  medium: 'bg-amber-400',
  laag: 'bg-emerald-400',
}

export const STATUS_COLORS: Record<string, string> = {
  concept: 'text-slate-400 bg-slate-800',
  verstuurd: 'text-blue-400 bg-blue-950/60',
  betaald: 'text-emerald-400 bg-emerald-950/60',
  verlopen: 'text-red-400 bg-red-950/60',
  geannuleerd: 'text-slate-500 bg-slate-800',
}

export const PROJECT_COLORS = [
  '#6172f3', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
]
