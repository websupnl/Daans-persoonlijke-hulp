export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { logActivity, syncEntityLinks } from '@/lib/activity'
import { jsonFail, jsonOk } from '@/lib/contracts/api-http'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const type = searchParams.get('type')

    let sql = 'SELECT * FROM contacts WHERE 1=1'
    const params: unknown[] = []
    let i = 1

    if (search) {
      sql += ` AND (name ILIKE $${i} OR email ILIKE $${i} OR company ILIKE $${i})`
      params.push(`%${search}%`)
      i++
    }
    if (type) {
      sql += ` AND type = $${i++}`
      params.push(type)
    }

    sql += ' ORDER BY name ASC'

    const contacts = (await query<Record<string, unknown>>(sql, params)).map((c) => ({
      ...c,
      tags: JSON.parse(c.tags as string || '[]'),
    }))

    return jsonOk(contacts, undefined, req)
  } catch (error: unknown) {
    return jsonFail('CONTACTS_LIST_FAILED', 'Kon contacten niet ophalen', 500, error, req)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, type, email, phone, company, website, address, notes, tags } = body

    if (!name?.trim()) return jsonFail('CONTACT_VALIDATION', 'Naam is verplicht', 400, undefined, req)

    const contact = await queryOne<Record<string, unknown>>(`
    INSERT INTO contacts (name, type, email, phone, company, website, address, notes, tags)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    name.trim(), type || 'persoon', email || null, phone || null,
    company || null, website || null, address || null,
    notes || null, JSON.stringify(tags || []),
  ])

    if (contact?.id) {
      await syncEntityLinks({
        sourceType: 'contact',
        sourceId: Number(contact.id),
        companyName: String(contact.company || company || ''),
        tags: tags || [],
      })
      await logActivity({
        entityType: 'contact',
        entityId: Number(contact.id),
        action: 'created',
        title: String(contact.name || name),
        summary: 'Contact toegevoegd',
        metadata: { type: type || 'persoon', company: company || null },
      })
    }

    return jsonOk({ ...contact, tags: JSON.parse(contact?.tags as string || '[]') }, { status: 201 }, req)
  } catch (error: unknown) {
    return jsonFail('CONTACT_CREATE_FAILED', 'Kon contact niet opslaan', 500, error, req)
  }
}
