import { NextRequest, NextResponse } from 'next/server'
import getDb from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const contactId = searchParams.get('contact_id')

  let query = `
    SELECT f.*, c.name as contact_name, p.title as project_title
    FROM finance_items f
    LEFT JOIN contacts c ON f.contact_id = c.id
    LEFT JOIN projects p ON f.project_id = p.id
    WHERE 1=1
  `
  const params: (string | number)[] = []

  if (type) { query += ' AND f.type = ?'; params.push(type) }
  if (status) { query += ' AND f.status = ?'; params.push(status) }
  if (contactId) { query += ' AND f.contact_id = ?'; params.push(parseInt(contactId)) }

  query += ' ORDER BY f.created_at DESC'

  const items = db.prepare(query).all(...params)

  // Statistieken
  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as open_amount,
      COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_count,
      SUM(CASE WHEN type IN ('inkomst','factuur') AND status='betaald' AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_income,
      SUM(CASE WHEN type='uitgave' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_expenses
    FROM finance_items
  `).get() as Record<string, number>

  return NextResponse.json({ data: items, stats })
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { type, title, description, amount, contact_id, project_id, status, due_date, category } = body

  if (!type || !title) return NextResponse.json({ error: 'Type en titel zijn verplicht' }, { status: 400 })

  // Auto invoice number voor facturen
  let invoiceNumber: string | null = null
  if (type === 'factuur') {
    const year = new Date().getFullYear()
    const count = (db.prepare("SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND strftime('%Y', created_at) = ?").get(String(year)) as { c: number }).c
    invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`
  }

  const result = db.prepare(`
    INSERT INTO finance_items (type, title, description, amount, contact_id, project_id, status, invoice_number, due_date, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    type, title, description || null, amount || 0,
    contact_id || null, project_id || null,
    status || (type === 'factuur' ? 'concept' : 'betaald'),
    invoiceNumber, due_date || null,
    category || 'overig'
  )

  const item = db.prepare(`
    SELECT f.*, c.name as contact_name FROM finance_items f
    LEFT JOIN contacts c ON f.contact_id = c.id
    WHERE f.id = ?
  `).get(result.lastInsertRowid)

  return NextResponse.json({ data: item }, { status: 201 })
}
