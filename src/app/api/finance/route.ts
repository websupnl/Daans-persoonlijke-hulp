import { NextRequest, NextResponse } from 'next/server'
import getDb, { toRows, toRow } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = await getDb()
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
  const args: (string | number)[] = []

  if (type) { query += ' AND f.type = ?'; args.push(type) }
  if (status) { query += ' AND f.status = ?'; args.push(status) }
  if (contactId) { query += ' AND f.contact_id = ?'; args.push(parseInt(contactId)) }

  query += ' ORDER BY f.created_at DESC'

  const items = toRows(await db.execute({ sql: query, args }))

  const statsRow = toRow(await db.execute(`
    SELECT
      SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END) as open_amount,
      COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_count,
      SUM(CASE WHEN type IN ('inkomst','factuur') AND status='betaald' AND strftime('%Y-%m', paid_date) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_income,
      SUM(CASE WHEN type='uitgave' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN amount ELSE 0 END) as month_expenses
    FROM finance_items
  `))

  return NextResponse.json({ data: items, stats: statsRow })
}

export async function POST(req: NextRequest) {
  const db = await getDb()
  const body = await req.json()
  const { type, title, description, amount, contact_id, project_id, status, due_date, category } = body

  if (!type || !title) return NextResponse.json({ error: 'Type en titel zijn verplicht' }, { status: 400 })

  let invoiceNumber: string | null = null
  if (type === 'factuur') {
    const year = new Date().getFullYear()
    const countRow = toRow(await db.execute({ sql: `SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND strftime('%Y', created_at) = ?`, args: [String(year)] }))
    const count = (countRow?.c as number) ?? 0
    invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`
  }

  const result = await db.execute({
    sql: `INSERT INTO finance_items (type, title, description, amount, contact_id, project_id, status, invoice_number, due_date, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      type, title, description || null, amount || 0,
      contact_id || null, project_id || null,
      status || (type === 'factuur' ? 'concept' : 'betaald'),
      invoiceNumber, due_date || null,
      category || 'overig',
    ],
  })

  const item = toRow(await db.execute({
    sql: `SELECT f.*, c.name as contact_name FROM finance_items f LEFT JOIN contacts c ON f.contact_id = c.id WHERE f.id = ?`,
    args: [Number(result.lastInsertRowid)],
  }))

  return NextResponse.json({ data: item }, { status: 201 })
}
