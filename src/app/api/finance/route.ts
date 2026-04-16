export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne, execute } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const contactId = searchParams.get('contact_id')
  const account = searchParams.get('account')
  const from = searchParams.get('from') // YYYY-MM-DD
  const to = searchParams.get('to')     // YYYY-MM-DD

  let sql = `
    SELECT f.*, c.name as contact_name, p.title as project_title
    FROM finance_items f
    LEFT JOIN contacts c ON f.contact_id = c.id
    LEFT JOIN projects p ON f.project_id = p.id
    WHERE 1=1
  `
  const params: unknown[] = []
  let i = 1

  if (type) { sql += ` AND f.type = $${i++}`; params.push(type) }
  if (status) { sql += ` AND f.status = $${i++}`; params.push(status) }
  if (contactId) { sql += ` AND f.contact_id = $${i++}`; params.push(parseInt(contactId)) }
  if (account) { sql += ` AND f.account = $${i++}`; params.push(account) }

  if (from) {
    sql += ` AND COALESCE(f.due_date, f.created_at::date) >= $${i++}`
    params.push(from)
  }
  if (to) {
    sql += ` AND COALESCE(f.due_date, f.created_at::date) <= $${i++}`
    params.push(to)
  }

  sql += ' ORDER BY COALESCE(f.due_date, f.created_at::date) DESC, f.created_at DESC'

  const rawItems = await query(sql, params)
  const items = rawItems.map((item: Record<string, unknown>) => ({ ...item, amount: Number(item.amount) }))

  // Statistieken
  // Als er een range is (from/to), gebruik die. Anders huidige maand.
  const stats = await queryOne<Record<string, unknown>>(`
    SELECT
      SUM(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN amount ELSE 0 END)::float as open_amount,
      COUNT(CASE WHEN type='factuur' AND status IN ('verstuurd','verlopen') THEN 1 END) as open_count,
      SUM(CASE WHEN type IN ('inkomst','factuur') AND status='betaald'
        AND ($3::text IS NULL OR account = $3)
        AND (
          ($1::date IS NOT NULL AND $2::date IS NOT NULL AND COALESCE(paid_date, due_date, created_at::date) BETWEEN $1 AND $2)
          OR ($1::date IS NULL AND TO_CHAR(COALESCE(paid_date, due_date, created_at::date), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM'))
        )
        THEN amount ELSE 0 END)::float as month_income,
      SUM(CASE WHEN type='uitgave'
        AND ($3::text IS NULL OR account = $3)
        AND (
          ($1::date IS NOT NULL AND $2::date IS NOT NULL AND COALESCE(due_date, created_at::date) BETWEEN $1 AND $2)
          OR ($1::date IS NULL AND TO_CHAR(COALESCE(due_date, created_at::date), 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM'))
        )
        THEN amount ELSE 0 END)::float as month_expenses
    FROM finance_items
  `, [from || null, to || null, account || null])

  return NextResponse.json({ data: items, stats: { ...stats, active_month: from ? from.slice(0, 7) : TO_CHAR_NOW() } })
}

function TO_CHAR_NOW() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const account = searchParams.get('account')

  let sql = 'DELETE FROM finance_items WHERE 1=1'
  const params: unknown[] = []
  let i = 1
  if (type) { sql += ` AND type = $${i++}`; params.push(type) }
  if (account) { sql += ` AND account = $${i++}`; params.push(account) }

  await execute(sql, params)
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, title, description, amount, contact_id, project_id, status, due_date, category, account } = body

  if (!type || !title) return NextResponse.json({ error: 'Type en titel zijn verplicht' }, { status: 400 })

  // Auto invoice number voor facturen
  let invoiceNumber: string | null = null
  if (type === 'factuur') {
    const year = new Date().getFullYear()
    const countRow = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM finance_items WHERE type='factuur' AND TO_CHAR(created_at, 'YYYY') = $1`, [String(year)])
    const count = countRow?.c ?? 0
    invoiceNumber = `${year}-${String(count + 1).padStart(3, '0')}`
  }

  const item = await queryOne(`
    INSERT INTO finance_items (type, title, description, amount, contact_id, project_id, status, invoice_number, due_date, category, account)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `, [
    type, title, description || null, amount || 0,
    contact_id || null, project_id || null,
    status || (type === 'factuur' ? 'concept' : 'betaald'),
    invoiceNumber, due_date || null,
    category || 'overig',
    account || 'privé',
  ])

  if (item && 'id' in item) {
    await syncEntityLinks({
      sourceType: 'finance',
      sourceId: Number(item.id),
      projectId: project_id || null,
      contactId: contact_id || null,
      tags: [category || 'overig', type],
    })
    await logActivity({
      entityType: 'finance',
      entityId: Number(item.id),
      action: 'created',
      title: String(title),
      summary: `${type} opgeslagen`,
      metadata: { amount: amount || 0, type, status: status || (type === 'factuur' ? 'concept' : 'betaald') },
    })
  }

  return NextResponse.json({ data: item }, { status: 201 })
}
