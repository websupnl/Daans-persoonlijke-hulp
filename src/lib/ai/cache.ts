/**
 * AI Summary Cache - Voorkom onnodige AI calls
 * Cache duration: 15 minuten per module type
 */

interface CachedSummary {
  summary: string
  timestamp: number
  type: string
}

const CACHE_DURATION = 15 * 60 * 1000 // 15 minuten
const cache = new Map<string, CachedSummary>()

export function getCachedSummary(type: string): string | null {
  const cached = cache.get(type)
  if (!cached) return null
  
  const now = Date.now()
  if (now - cached.timestamp > CACHE_DURATION) {
    cache.delete(type)
    return null
  }
  
  return cached.summary
}

export function setCachedSummary(type: string, summary: string): void {
  cache.set(type, {
    summary,
    timestamp: Date.now(),
    type
  })
}

export function clearCache(): void {
  cache.clear()
}
