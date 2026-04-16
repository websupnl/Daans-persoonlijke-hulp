export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { execute } from '@/lib/db'

interface ParsedRow {
  date: string
  description: string
  amount: number
  type: 'inkomst' | 'uitgave'
  category: string
  account: string
}

/** Parse Dutch amount string "1.234,56" or "1234.56" → number */
function parseDutchAmount(s: string): number {
  const cleaned = s.trim().replace(/[€$\s]/g, '')
  if (!cleaned) return 0
  
  const isNegative = cleaned.startsWith('-')
  const absCleaned = isNegative ? cleaned.slice(1) : cleaned
  
  let value: number
  // Dutch format: 1.234,56 → remove dots, replace comma with dot
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(absCleaned)) {
    value = parseFloat(absCleaned.replace(/\./g, '').replace(',', '.'))
  } else {
    // English/generic: 1234.56
    value = parseFloat(absCleaned.replace(',', '.')) || 0
  }
  return isNegative ? -value : value
}

/** Normalize various date formats to YYYY-MM-DD */
function normalizeDate(s: string): string {
  if (!s) return new Date().toISOString().split('T')[0]
  const clean = s.trim()
  
  // DD-MM-YYYY or D-M-YYYY
  const dmy = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }
  
  // DD/MM/YYYY or D/M/YYYY
  const dmy2 = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy2) {
    return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`
  }

  // YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  
  return clean
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

      if (amount <= 0) continue
      rows.push({
        date: normalizeDate(rawDate),
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type: afBij.startsWith('bij') ? 'inkomst' : 'uitgave',
        category: guessCategory(desc),
        account: '',
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
      const date = cols[idxDate] ?? ''

      if (amount <= 0) continue
      rows.push({
        date: normalizeDate(date),
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type,
        category: guessCategory(desc),
        account: '',
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
        date: normalizeDate(cols[idxDate] ?? ''),
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type,
        category: guessCategory(desc),
        account: '',
      })
    }
    return rows
  }

  // ── Custom format (Daan's bank export) ──
  // Columns: datum_volledig, datum, code, code_omschrijving, richting, debet, credit, bedrag, bedrag_genormaliseerd, omschrijving, pagina
  const isCustom = headers.includes('datum_volledig') || (headers.includes('richting') && (headers.includes('debet') || headers.includes('credit') || headers.includes('bedrag_genormaliseerd')))
  if (isCustom) {
    const idxDate = headers.findIndex(h => h === 'datum_volledig') >= 0 ? headers.findIndex(h => h === 'datum_volledig') : headers.findIndex(h => h === 'datum')
    const idxDesc = headers.findIndex(h => h === 'omschrijving')
    const idxCodeDesc = headers.findIndex(h => h === 'code_omschrijving')
    const idxAmountNormal = headers.findIndex(h => h === 'bedrag_genormaliseerd')
    const idxDebet = headers.findIndex(h => h === 'debet')
    const idxCredit = headers.findIndex(h => h === 'credit')
    const idxBedrag = headers.findIndex(h => h === 'bedrag')
    const idxRichting = headers.findIndex(h => h === 'richting')

    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = splitCsvLine(line, delimiter)

      let amount = 0
      let type: 'inkomst' | 'uitgave' = 'uitgave'

      if (idxAmountNormal >= 0 && cols[idxAmountNormal]) {
        // bedrag_genormaliseerd: negative = uitgave, positive = inkomst
        const raw = parseDutchAmount(cols[idxAmountNormal])
        amount = Math.abs(raw)
        type = raw >= 0 ? 'inkomst' : 'uitgave'
      } else if (idxDebet >= 0 || idxCredit >= 0) {
        // Separate debet/credit columns
        const debet = idxDebet >= 0 ? Math.abs(parseDutchAmount(cols[idxDebet] ?? '')) : 0
        const credit = idxCredit >= 0 ? Math.abs(parseDutchAmount(cols[idxCredit] ?? '')) : 0
        if (credit > 0) { amount = credit; type = 'inkomst' }
        else if (debet > 0) { amount = debet; type = 'uitgave' }
      } else if (idxBedrag >= 0) {
        amount = Math.abs(parseDutchAmount(cols[idxBedrag] ?? '0'))
        if (idxRichting >= 0) {
          const richting = (cols[idxRichting] ?? '').toLowerCase()
          type = richting.includes('bij') || richting === 'credit' || richting === 'in' ? 'inkomst' : 'uitgave'
        }
      }

      if (amount <= 0) continue

      const rawDesc = cols[idxDesc] ?? ''
      const codeDesc = idxCodeDesc >= 0 ? (cols[idxCodeDesc] ?? '') : ''
      const desc = rawDesc || codeDesc
      rows.push({
        date: normalizeDate(cols[idxDate] ?? ''),
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type,
        category: guessCategory(desc),
        account: '',
      })
    }
    return rows
  }

  // ── Generic fallback: look for date, amount, description columns ──
  const idxDate = headers.findIndex(h => /datum|date/.test(h))
  const idxAmountNormal = headers.findIndex(h => h.includes('genormaliseerd'))
  const idxAmount = headers.findIndex(h => /bedrag|amount|euro|eur/.test(h))
  const idxDesc = headers.findIndex(h => /omschrijving|description|naam|name|detail/.test(h))
  const idxRichting = headers.findIndex(h => /richting|type|af.?bij/.test(h))

  if (idxAmount >= 0 || idxAmountNormal >= 0) {
    const bestAmtIdx = idxAmountNormal >= 0 ? idxAmountNormal : idxAmount
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue
      const cols = splitCsvLine(line, delimiter)
      const rawAmount = parseDutchAmount(cols[bestAmtIdx] ?? '0')
      const amount = Math.abs(rawAmount)
      if (amount <= 0) continue
      
      let type: 'inkomst' | 'uitgave' = rawAmount >= 0 ? 'inkomst' : 'uitgave'
      if (idxRichting >= 0 && idxAmountNormal < 0) {
        const richting = (cols[idxRichting] ?? '').toLowerCase()
        if (richting.includes('bij') || richting.includes('in') || richting.includes('credit')) type = 'inkomst'
        else if (richting.includes('af') || richting.includes('uit') || richting.includes('debet')) type = 'uitgave'
      }

      const desc = idxDesc >= 0 ? (cols[idxDesc] ?? '') : line.slice(0, 60)
      rows.push({
        date: normalizeDate(idxDate >= 0 ? (cols[idxDate] ?? '') : ''),
        description: desc.trim().slice(0, 120) || 'Transactie',
        amount,
        type,
        category: guessCategory(desc),
        account: '',
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
  const account = (formData.get('account') as string | null) || 'privé'

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
        INSERT INTO finance_items (type, title, amount, category, account, status, due_date, created_at)
        VALUES ($1, $2, $3, $4, $5, 'betaald', $6, NOW())
      `, [row.type, row.description, row.amount, row.category, account, row.date])
      imported++
    } catch { /* skip duplicates */ }
  }

  return NextResponse.json({ imported, total: rows.length })
}
