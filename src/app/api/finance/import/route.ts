export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'

interface ParsedRow {
  date: string
  description: string
  amount: number
  type: 'inkomst' | 'uitgave'
  category: string
}

/** Parse Dutch amount string "1.234,56" or "1234.56" → number */
function parseDutchAmount(s: string): number {
  const cleaned = s.trim().replace(/[€$\s]/g, '')
  // Dutch format: 1.234,56 → remove dots, replace comma with dot
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  // English/generic: 1234.56
  return parseFloat(cleaned.replace(',', '.')) || 0
}

/** Detect CSV delimiter by counting occurrences in first line */
function detectDelimiter(firstLine: string): string {
  const counts = { ';': 0, ',': 0, '\t': 0 }
  for (const c of firstLine) {
    if (c in counts) counts[c as keyof typeof counts]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

/** Split CSV line respecting quoted fields */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuotes = !inQuotes; continue }
    if (c === delimiter && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += c
  }
  result.push(current.trim())
  return result
}

function guessCategory(desc: string): string {
  const d = desc.toLowerCase()
  if (/albert.heijn|jumbo|lidl|aldi|boni|plus super|dirk|ah |supermarkt/.test(d)) return 'boodschappen'
  if (/shell|bp|tinq|tango|nexi|esso|benzine|brandstof/.test(d)) return 'auto'
  if (/ns |trein|ov-chip|connexxion|arriva|bus |metro/.test(d)) return 'transport'
  if (/restaurant|cafe |kafe|mcdonalds|subway|pizza|snack|brood|bakker|ontbijt|lunch|diner/.test(d)) return 'eten'
  if (/spotify|netflix|prime|disney|videoland|bol\.com|steam/.test(d)) return 'abonnement'
  if (/belasting|kvk|gemeente|overheid/.test(d)) return 'belasting'
  if (/huur|hypotheek|energie|nuon|vattenfall|essent|ziggo|kpn|t-mobile/.test(d)) return 'vaste lasten'
  if (/zalando|h&m|zara|coolblue|mediamarkt|ikea/.test(d)) return 'kleding'
  return 'overig'
}

function detectFormatAndParse(lines: string[], delimiter: string): ParsedRow[] {
  if (lines.length < 2) return []

  const headers = splitCsvLine(lines[0], delimiter).map(h => h.toLowerCase().replace(/['"]/g, '').trim())
  const rows: ParsedRow[] = []

  // ── ING Bank format ──
  // Datum;Naam / Omschrijving;Rekening;Tegenrekening;Code;Af Bij;Bedrag (EUR);MutatieSoort;Mededelingen
  const isING = headers.some(h => h.includes('af bij') || h.includes('bedrag (eur)') || h.includes('naam / omschrijving'))
  if (isING) {
    const idxDate = headers.findIndex(h => h === 'datum')
    const idxDesc = headers.findIndex(h => h.includes('omschrijving') || h.includes('naam'))
    const idxAfBij = headers.findIndex(h => h.includes('af bij'))
    const idxBedrag = headers.findIndex(h => h.includes('bedrag'))
    const idxMemo = headers.findIndex(h => h.includes('mededeling'))

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = splitCsvLine(line, delimiter)
      const rawDate = cols[idxDate] ?? ''
      const desc = (cols[idxDesc] ?? '') + (idxMemo >= 0 && cols[idxMemo] ? ' — ' + cols[idxMemo] : '')
      const afBij = (cols[idxAfBij] ?? '').toLowerCase()
      const amount = parseDutchAmount(cols[idxBedrag] ?? '0')

      // ING date format: YYYYMMDD
      let date = rawDate
      if (/^\d{8}$/.test(rawDate)) {
        date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      }

      if (amount <= 0) continue
      rows.push({
        date,
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type: afBij.startsWith('bij') ? 'inkomst' : 'uitgave',
        category: guessCategory(desc),
      })
    }
    return rows
  }

  // ── Rabobank format ──
  // IBAN/BBAN;Munt;BIC;Volgnr;Datum;Rentedatum;Bedrag;Saldo na trn;Tegenpartij IBAN;Tegenpartij naam;Initierende partij;Machtigingskenmerk;Crediteurnummer;Eindtotaal;Omschrijving-1...
  const isRabo = headers.some(h => h.includes('iban') || h.includes('tegenpartij naam') || h.includes('volgnr'))
  if (isRabo) {
    const idxDate = headers.findIndex(h => h === 'datum')
    const idxDesc = headers.findIndex(h => h.includes('tegenpartij naam') || h.includes('omschrijving'))
    const idxBedrag = headers.findIndex(h => h === 'bedrag')

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = splitCsvLine(line, delimiter)
      const rawAmount = parseDutchAmount(cols[idxBedrag] ?? '0')
      const amount = Math.abs(rawAmount)
      const type: 'inkomst' | 'uitgave' = rawAmount >= 0 ? 'inkomst' : 'uitgave'
      const desc = cols[idxDesc] ?? ''
      const date = cols[idxDate] ?? new Date().toISOString().split('T')[0]

      if (amount <= 0) continue
      rows.push({
        date,
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type,
        category: guessCategory(desc),
      })
    }
    return rows
  }

  // ── ABN AMRO (tab-separated) ──
  // Account Number\tTransaction date\tAmount debit\tAmount credit\tTransaction type\tNotification\tReference number
  const isABN = headers.some(h => h.includes('account number') || h.includes('amount debit') || h.includes('amount credit'))
  if (isABN) {
    const idxDate = headers.findIndex(h => h.includes('date'))
    const idxDebit = headers.findIndex(h => h.includes('debit'))
    const idxCredit = headers.findIndex(h => h.includes('credit'))
    const idxDesc = headers.findIndex(h => h.includes('notification') || h.includes('reference'))

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = splitCsvLine(line, delimiter)
      const debit = parseDutchAmount(cols[idxDebit] ?? '')
      const credit = parseDutchAmount(cols[idxCredit] ?? '')
      const amount = debit > 0 ? debit : credit
      const type: 'inkomst' | 'uitgave' = credit > 0 ? 'inkomst' : 'uitgave'
      const desc = cols[idxDesc] ?? ''

      if (amount <= 0) continue
      rows.push({
        date: cols[idxDate] ?? new Date().toISOString().split('T')[0],
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type,
        category: guessCategory(desc),
      })
    }
    return rows
  }

  // ── Generic fallback: look for date, amount, description columns ──
  const idxDate = headers.findIndex(h => /datum|date/.test(h))
  const idxAmount = headers.findIndex(h => /bedrag|amount|euro|eur/.test(h))
  const idxDesc = headers.findIndex(h => /omschrijving|description|naam|name|detail/.test(h))

  if (idxAmount >= 0) {
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = splitCsvLine(line, delimiter)
      const rawAmount = parseDutchAmount(cols[idxAmount] ?? '0')
      const amount = Math.abs(rawAmount)
      if (amount <= 0) continue
      const desc = idxDesc >= 0 ? (cols[idxDesc] ?? '') : line.slice(0, 60)
      rows.push({
        date: idxDate >= 0 ? (cols[idxDate] ?? new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type: rawAmount >= 0 ? 'inkomst' : 'uitgave',
        category: guessCategory(desc),
      })
    }
  }

  return rows
}

/** POST — Parse CSV and optionally import */
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const doImport = formData.get('import') === 'true'

  if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

  const text = await file.text()
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return NextResponse.json({ error: 'Bestand heeft te weinig rijen' }, { status: 400 })

  const delimiter = detectDelimiter(lines[0])
  const rows = detectFormatAndParse(lines, delimiter)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Geen transacties herkend. Probeer ING, Rabobank of ABN AMRO CSV export.' }, { status: 422 })
  }

  if (!doImport) {
    // Return preview only
    return NextResponse.json({ preview: rows, count: rows.length })
  }

  // Bulk import
  let imported = 0
  for (const row of rows) {
    try {
      await execute(`
        INSERT INTO finance_items (type, title, amount, category, status, due_date, created_at)
        VALUES ($1, $2, $3, $4, 'betaald', $5, NOW())
      `, [row.type, row.description, row.amount, row.category, row.date])
      imported++
    } catch { /* skip duplicates */ }
  }

  return NextResponse.json({ imported, total: rows.length })
}
