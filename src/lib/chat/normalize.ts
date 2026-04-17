const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bweetje\b/g, 'weet je'],
  [/\bwat weetje\b/g, 'wat weet je'],
  [/\bvamdaag\b/g, 'vandaag'],
  [/\bvandaaf\b/g, 'vandaag'],
  [/\bwekrklog\b/g, 'werklog'],
  [/\bprimeanimalz\b/g, 'prime animalz'],
  [/\bprimeanimals\b/g, 'prime animalz'],
  [/\bjermey\b/g, 'jeremy'],
  [/\bgehwd\b/g, 'gehad'],
]

export function normalizeDutch(text: string): string {
  let value = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    value = value.replace(pattern, replacement)
  }

  return value
}

export function compactNormalized(text: string): string {
  return normalizeDutch(text).replace(/[^a-z0-9]+/g, '')
}

export function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate))
}

export function hasWord(text: string, word: string): boolean {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(word)}(\\s|$)`, 'i')
  return pattern.test(text)
}

export function stripSourcePrefix(text: string): string {
  return text.replace(/^\[[^\]]+\]\s*/, '').trim()
}

export function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const matrix = Array.from({ length: b.length + 1 }, (_, row) =>
    Array.from({ length: a.length + 1 }, (_, col) => (row === 0 ? col : col === 0 ? row : 0))
  )

  for (let row = 1; row <= b.length; row++) {
    for (let col = 1; col <= a.length; col++) {
      const cost = a[col - 1] === b[row - 1] ? 0 : 1
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      )
    }
  }

  return matrix[b.length][a.length]
}

export function looseEntityMatch(input: string, candidate: string): boolean {
  const left = compactNormalized(input)
  const right = compactNormalized(candidate)
  if (!left || !right) return false
  if (left.includes(right) || right.includes(left)) return true
  if (Math.abs(left.length - right.length) > 2) return false
  return levenshtein(left, right) <= 2
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
