/**
 * Import Normalizer
 *
 * Detecteert het formaat van de input en normaliseert naar platte tekst
 * die de segmentatie-engine kan verwerken.
 *
 * Ondersteunde formaten:
 * - Plaktekst (altijd)
 * - .txt / .md (file upload)
 * - .json (ChatGPT export, Claude export, generiek)
 * - JSONL (Claude export)
 */

export type SourceType =
  | 'paste'
  | 'file_txt'
  | 'file_md'
  | 'file_json'
  | 'chatgpt_export'
  | 'claude_export'
  | 'jsonl'

export interface NormalizedInput {
  sourceType: SourceType
  sourceLabel: string
  normalized: string
  rawLength: number
  detectedFormat: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Format detectors
// ─────────────────────────────────────────────────────────────────────────────

function detectChatGPTExport(json: any): boolean {
  return (
    typeof json === 'object' &&
    !Array.isArray(json) &&
    ('mapping' in json || ('conversations' in json && Array.isArray(json.conversations)))
  )
}

function detectClaudeExport(json: any): boolean {
  return (
    Array.isArray(json) &&
    json.length > 0 &&
    json[0] &&
    'uuid' in json[0] &&
    'chat_messages' in json[0]
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Format-specific extractors
// ─────────────────────────────────────────────────────────────────────────────

function extractChatGPT(json: any): string {
  const lines: string[] = []

  // New format: { mapping: { [id]: { message: { role, content } } } }
  if (json.mapping) {
    const nodes = Object.values(json.mapping) as any[]
    for (const node of nodes) {
      const msg = node?.message
      if (!msg) continue
      const role = msg.role
      if (role !== 'user' && role !== 'assistant') continue
      const parts = msg.content?.parts
      if (!Array.isArray(parts)) continue
      const text = parts.filter((p: any) => typeof p === 'string').join(' ').trim()
      if (text.length > 10) {
        lines.push(`[${role === 'user' ? 'Ik' : 'AI'}]: ${text}`)
      }
    }
  }

  // Old format: { conversations: [ { messages: [ { role, content } ] } ] }
  if (json.conversations) {
    for (const convo of json.conversations) {
      for (const msg of convo.messages ?? []) {
        if (msg.role !== 'user') continue
        const text = String(msg.content ?? '').trim()
        if (text.length > 10) lines.push(text)
      }
    }
  }

  return lines.join('\n\n')
}

function extractClaude(json: any[]): string {
  const lines: string[] = []
  for (const convo of json) {
    for (const msg of convo.chat_messages ?? []) {
      if (msg.sender !== 'human') continue
      const text = (msg.text ?? '').trim()
      if (text.length > 10) lines.push(text)
    }
  }
  return lines.join('\n\n')
}

function extractJsonGeneric(json: any): string {
  // Try to stringify in a readable way
  if (typeof json === 'string') return json
  if (Array.isArray(json)) {
    return json
      .map((item: any) => {
        if (typeof item === 'string') return item
        if (item?.text) return String(item.text)
        if (item?.content) return String(item.content)
        if (item?.value) return String(item.value)
        return JSON.stringify(item)
      })
      .join('\n\n')
  }
  return JSON.stringify(json, null, 2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown stripper
// ─────────────────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')          // headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')    // bold
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/__([^_]+)__/g, '$1')        // bold alt
    .replace(/_([^_]+)_/g, '$1')          // italic alt
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // code
    .replace(/!\[.*?\]\(.*?\)/g, '')      // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text only
    .replace(/^[-*+]\s+/gm, '• ')         // list items
    .replace(/^\d+\.\s+/gm, '')           // numbered lists
    .replace(/^>\s+/gm, '')               // blockquotes
    .replace(/---+/g, '')                 // horizontal rules
}

// ─────────────────────────────────────────────────────────────────────────────
// Text cleaner
// ─────────────────────────────────────────────────────────────────────────────

function cleanText(text: string): string {
  return text
    .replace(/\u2018|\u2019/g, "'")       // smart quotes
    .replace(/\u201C|\u201D/g, '"')       // smart double quotes
    .replace(/\[(\d{4}-\d{2}-\d{2}[^\]]*)\]/g, '') // timestamps [2024-01-15 14:23]
    .replace(/(\d{1,2}:\d{2}(:\d{2})?)\s*(AM|PM)?/g, '') // bare time stamps
    .replace(/[ \t]{2,}/g, ' ')           // multiple spaces
    .replace(/\n{3,}/g, '\n\n')           // max 2 newlines
    .trim()
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeText(
  rawInput: string,
  filename?: string
): NormalizedInput {
  const ext = filename?.split('.').pop()?.toLowerCase()
  const now = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

  // Try JSON parse
  if (ext === 'json' || (!ext && rawInput.trimStart().startsWith('{'))) {
    try {
      const json = JSON.parse(rawInput)

      if (detectChatGPTExport(json)) {
        const text = cleanText(extractChatGPT(json))
        return {
          sourceType: 'chatgpt_export',
          sourceLabel: filename ?? `ChatGPT export ${now}`,
          normalized: text,
          rawLength: rawInput.length,
          detectedFormat: 'ChatGPT conversations export',
        }
      }

      if (detectClaudeExport(json)) {
        const text = cleanText(extractClaude(json))
        return {
          sourceType: 'claude_export',
          sourceLabel: filename ?? `Claude export ${now}`,
          normalized: text,
          rawLength: rawInput.length,
          detectedFormat: 'Claude conversations export',
        }
      }

      const text = cleanText(extractJsonGeneric(json))
      return {
        sourceType: 'file_json',
        sourceLabel: filename ?? `JSON import ${now}`,
        normalized: text,
        rawLength: rawInput.length,
        detectedFormat: 'Generic JSON',
      }
    } catch {
      // Not valid JSON, fall through to text processing
    }
  }

  // Try JSONL
  if (rawInput.trimStart().startsWith('{') && rawInput.includes('\n{')) {
    try {
      const lines = rawInput.trim().split('\n')
      const objects = lines.map(l => JSON.parse(l))
      const texts = objects
        .filter((o: any) => o.role === 'user' || o.sender === 'human')
        .map((o: any) => String(o.content ?? o.text ?? '').trim())
        .filter(t => t.length > 10)
      if (texts.length > 0) {
        return {
          sourceType: 'jsonl',
          sourceLabel: filename ?? `JSONL import ${now}`,
          normalized: cleanText(texts.join('\n\n')),
          rawLength: rawInput.length,
          detectedFormat: 'JSONL chat export',
        }
      }
    } catch { /* fall through */ }
  }

  // Markdown file
  if (ext === 'md') {
    const text = cleanText(stripMarkdown(rawInput))
    return {
      sourceType: 'file_md',
      sourceLabel: filename ?? `Markdown import ${now}`,
      normalized: text,
      rawLength: rawInput.length,
      detectedFormat: 'Markdown bestand',
    }
  }

  // Plain text or paste
  const sourceType: SourceType = ext === 'txt' ? 'file_txt' : 'paste'
  const text = cleanText(rawInput)
  return {
    sourceType,
    sourceLabel: filename ?? `Geplakt op ${now}`,
    normalized: text,
    rawLength: rawInput.length,
    detectedFormat: ext === 'txt' ? 'Tekstbestand' : 'Geplakte tekst',
  }
}

/**
 * Split normalized text into chunks for large inputs.
 * Returns array of chunks with ~3000 chars max, 200-char overlap.
 */
export function chunkText(text: string, maxChars = 3000, overlap = 200): string[] {
  if (text.length <= maxChars) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + maxChars

    // Try to break at paragraph boundary
    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end)
      if (paraBreak > start + maxChars / 2) {
        end = paraBreak
      } else {
        // Break at sentence boundary
        const sentBreak = text.lastIndexOf('. ', end)
        if (sentBreak > start + maxChars / 2) end = sentBreak + 1
      }
    }

    chunks.push(text.slice(start, end).trim())
    start = end - overlap
  }

  return chunks.filter(c => c.length > 50)
}
